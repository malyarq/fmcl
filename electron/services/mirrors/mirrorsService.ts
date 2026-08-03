import { Mirror, MirrorMoveDirection, MirrorState } from '@shared/types';
import { app } from 'electron';
import path from 'path';
import { randomUUID } from 'crypto';

import { net as electronNet } from 'electron';
import { assertTrustedEndpointUrl } from '../../security/trustedEndpoints';
import { AtomicJsonStore } from '../storage/atomicJsonStore';

const DEFAULT_MIRRORS: Mirror[] = [
    {
        id: 'official',
        name: 'Official (Mojang)',
        type: 'official',
        rootUrl: 'https://launchermeta.mojang.com',
        priority: 1,
        isActive: true,
    },
    {
        id: 'bmcl',
        name: 'BMCLAPI',
        type: 'bmcl',
        rootUrl: 'https://bmclapi2.bangbang93.com',
        priority: 2,
        isActive: false,
    },
];

type PersistedMirrorState = Partial<MirrorState> & {
    mirrors?: Mirror[];
    selectedMirrorId?: string;
};

function isPersistedMirrorState(value: unknown): value is PersistedMirrorState {
    if (!value || typeof value !== 'object') return false;
    const candidate = value as PersistedMirrorState;
    return (candidate.mirrors === undefined || Array.isArray(candidate.mirrors))
        && (candidate.autoSelect === undefined || typeof candidate.autoSelect === 'boolean')
        && (candidate.selectedMirrorId === undefined || typeof candidate.selectedMirrorId === 'string');
}

export class MirrorsService {
    private state: MirrorState = this.createInitialState();
    private mirrorsStore: AtomicJsonStore<PersistedMirrorState>;

    constructor() {
        const userDataPath = app.getPath('userData');
        this.mirrorsStore = new AtomicJsonStore(path.join(userDataPath, 'mirrors.json'), {
            version: 1,
            validate: isPersistedMirrorState,
        });
        this.loadMirrors();
    }

    private cloneMirror(mirror: Mirror): Mirror {
        return { ...mirror };
    }

    private createInitialState(): MirrorState {
        return {
            mirrors: this.decorateMirrors(DEFAULT_MIRRORS.map((mirror) => this.cloneMirror(mirror))),
            autoSelect: false,
        };
    }

    private decorateMirrors(mirrors: Mirror[]): Mirror[] {
        const activeMirrorId = mirrors.find((mirror) => !mirror.isDisabled)?.id;
        return mirrors.map((mirror, index) => ({
            ...mirror,
            priority: index + 1,
            isActive: mirror.id === activeMirrorId && !mirror.isDisabled,
        }));
    }

    private orderMirrors(
        mirrors: Mirror[],
        orderedIds: string[] = [],
        selectedMirrorId?: string,
    ): Mirror[] {
        const mirrorsById = new Map(mirrors.map((mirror) => [mirror.id, this.cloneMirror(mirror)]));
        const ordered: Mirror[] = [];

        const take = (id?: string) => {
            if (!id) {
                return;
            }

            const mirror = mirrorsById.get(id);
            if (!mirror) {
                return;
            }

            ordered.push(mirror);
            mirrorsById.delete(id);
        };

        take(selectedMirrorId);
        orderedIds.forEach((id) => take(id));
        mirrors.forEach((mirror) => take(mirror.id));

        return ordered;
    }

    private createPersistedState(state: MirrorState): PersistedMirrorState {
        return {
            mirrors: state.mirrors.map((mirror) => this.cloneMirror(mirror)),
            autoSelect: state.autoSelect,
            selectedMirrorId: state.mirrors.find((mirror) => mirror.isActive)?.id,
        };
    }

    private revalidateMirror(mirror: Mirror): Mirror {
        if (mirror.type !== 'custom') {
            return {
                ...mirror,
                isDisabled: false,
                disabledReason: undefined,
            };
        }

        try {
            assertTrustedEndpointUrl(mirror.rootUrl, 'Custom mirror URL');
            return {
                ...mirror,
                isDisabled: false,
                disabledReason: undefined,
            };
        } catch {
            return {
                ...mirror,
                isDisabled: true,
                disabledReason: 'insecureRemoteHttp',
                isActive: false,
            };
        }
    }

    private loadMirrors() {
        const loaded = this.mirrorsStore.read();
        if (loaded) {
            const savedState = loaded.value;
            const savedMirrors = Array.isArray(savedState.mirrors) ? savedState.mirrors : [];
            const customMirrors = savedMirrors
                .filter((mirror) => mirror.type === 'custom')
                .map((mirror) => this.revalidateMirror(mirror));
            const mergedMirrors = [
                ...DEFAULT_MIRRORS.map((mirror) => this.cloneMirror(mirror)),
                ...customMirrors,
            ];
            const orderedMirrors = this.orderMirrors(
                mergedMirrors,
                savedMirrors.map((mirror) => mirror.id),
                savedState.selectedMirrorId,
            );
            const nextState: MirrorState = {
                mirrors: this.decorateMirrors(orderedMirrors),
                autoSelect: savedState.autoSelect === true,
            };

            const normalized = JSON.stringify(this.createPersistedState(nextState), null, 2);
            if (loaded.legacy
                || loaded.source === 'backup'
                || normalized !== JSON.stringify(savedState, null, 2)) {
                this.mirrorsStore.write(this.createPersistedState(nextState));
            }
            this.state = nextState;
        }
    }

    private commitState(state: MirrorState) {
        this.mirrorsStore.write(this.createPersistedState(state));
        this.state = state;
    }

    public getMirrors(): Mirror[] {
        return this.state.mirrors.map((mirror) => this.cloneMirror(mirror));
    }

    public getSelectedMirror(): Mirror | undefined {
        const activeMirror = this.state.mirrors.find((mirror) => mirror.isActive);
        return activeMirror ? this.cloneMirror(activeMirror) : undefined;
    }

    public getPreferredMirrors(): Mirror[] {
        return this.state.mirrors
            .filter((mirror) => !mirror.isDisabled)
            .map((mirror) => this.cloneMirror(mirror));
    }

    public async addCustomMirror(name: string, rootUrl: string): Promise<Mirror> {
        const safeRootUrl = assertTrustedEndpointUrl(rootUrl, 'Custom mirror URL');
        const mirror: Mirror = {
            id: randomUUID(),
            name,
            type: 'custom',
            rootUrl: safeRootUrl,
            priority: this.state.mirrors.length + 1,
            isActive: false,
            isDisabled: false,
        };

        this.commitState({
            ...this.state,
            mirrors: this.decorateMirrors([...this.state.mirrors, mirror]),
        });
        return this.getMirrors().find((item) => item.id === mirror.id) ?? mirror;
    }

    public async removeMirror(id: string): Promise<void> {
        const mirror = this.state.mirrors.find((item) => item.id === id);
        if (!mirror) return;

        if (mirror.type !== 'custom') {
            throw new Error('Cannot remove default mirrors');
        }

        this.commitState({
            ...this.state,
            mirrors: this.decorateMirrors(this.state.mirrors.filter((item) => item.id !== id)),
        });
    }

    public async selectMirror(id: string): Promise<void> {
        const mirror = this.state.mirrors.find((item) => item.id === id);
        if (!mirror) throw new Error('Mirror not found');
        if (mirror.isDisabled) throw new Error('Mirror is disabled because its URL is insecure');

        this.commitState({
            ...this.state,
            mirrors: this.decorateMirrors(this.orderMirrors(this.state.mirrors, [id])),
        });
    }

    public async moveMirror(id: string, direction: MirrorMoveDirection): Promise<void> {
        const currentIndex = this.state.mirrors.findIndex((mirror) => mirror.id === id);
        if (currentIndex === -1) {
            throw new Error('Mirror not found');
        }

        const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
        if (targetIndex < 0 || targetIndex >= this.state.mirrors.length) {
            return;
        }

        const nextMirrors = this.state.mirrors.map((mirror) => this.cloneMirror(mirror));
        const [mirror] = nextMirrors.splice(currentIndex, 1);
        nextMirrors.splice(targetIndex, 0, mirror);
        this.commitState({ ...this.state, mirrors: this.decorateMirrors(nextMirrors) });
    }

    public async testSpeed(url: string): Promise<number> {
        const start = Date.now();
        try {
            const safeUrl = assertTrustedEndpointUrl(url, 'Mirror speed test URL');
            await electronNet.fetch(safeUrl, { method: 'HEAD', signal: AbortSignal.timeout(5000) });
            return Date.now() - start;
        } catch (e) {
            console.error('Mirror speed test failed:', e);
            return -1;
        }
    }

    public async setAutoSelect(enabled: boolean): Promise<void> {
        this.commitState({ ...this.state, autoSelect: enabled });
        if (enabled) {
            await this.autoSelectBestMirror();
        }
    }

    public async isAutoSelectEnabled(): Promise<boolean> {
        return this.state.autoSelect;
    }

    public async autoSelectBestMirror(): Promise<void> {
        console.log('Starting auto-selection of best mirror...');
        const selectableMirrors = this.state.mirrors.filter((mirror) => !mirror.isDisabled);
        const results = await Promise.all(selectableMirrors.map(async (mirror) => {
            const latency = await this.testSpeed(mirror.rootUrl);
            return { id: mirror.id, latency };
        }));

        const validResults = results.filter((result) => result.latency !== -1);

        if (validResults.length === 0) {
            console.warn('No reachable mirrors found during auto-selection.');
            return;
        }

        validResults.sort((a, b) => a.latency - b.latency);
        const orderedIds = [
            ...validResults.map((result) => result.id),
            ...this.state.mirrors
                .map((mirror) => mirror.id)
                .filter((id) => !validResults.some((result) => result.id === id)),
        ];
        const bestMirrorId = validResults[0].id;

        console.log(`Auto-selected mirror: ${bestMirrorId} with latency ${validResults[0].latency}ms`);
        this.commitState({
            ...this.state,
            mirrors: this.decorateMirrors(this.orderMirrors(this.state.mirrors, orderedIds)),
        });
    }
}
