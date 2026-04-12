export type MirrorType = 'official' | 'bmcl' | 'custom';
export type MirrorDisabledReason = 'insecureRemoteHttp';
export type MirrorMoveDirection = 'up' | 'down';

export interface Mirror {
    id: string;
    name: string;
    type: MirrorType;
    rootUrl: string; // The base URL for the mirror (e.g. https://bmclapi2.bangbang93.com)
    priority: number;
    isActive: boolean;
    isDisabled?: boolean;
    disabledReason?: MirrorDisabledReason;
}

export interface MirrorState {
    mirrors: Mirror[];
    autoSelect: boolean;
    selectedMirrorId?: string;
}
