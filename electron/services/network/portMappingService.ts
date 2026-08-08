import { upnpNat, type Gateway, type UPnPNAT } from '@achingbrain/nat-port-mapper';
import type { PortMappingDto, PortMappingSnapshot } from '../../../shared/contracts/network';
import { diagnostic, SerialQueue, StatePublisher, type StateListener } from './networkState';

export type PortMappingServiceOptions = { createClient?: () => UPnPNAT };

export class PortMappingService {
  private readonly state = new StatePublisher<PortMappingSnapshot>({ revision: 0, state: 'idle', mappings: [] });
  private readonly queue = new SerialQueue();
  private readonly createClient: () => UPnPNAT;
  private readonly mappings = new Map<number, PortMappingDto>();
  private client?: UPnPNAT;
  private gateway?: Gateway;
  private gatewayPromise?: Promise<Gateway>;

  constructor(options: PortMappingServiceOptions = {}) {
    this.createClient = options.createClient ?? (() => upnpNat({ autoRefresh: true }));
  }

  public getState(): PortMappingSnapshot { return this.state.get(); }
  public subscribe(listener: StateListener<PortMappingSnapshot>): () => void { return this.state.subscribe(listener); }

  public mapTcp(publicPort: number, privatePort: number): Promise<PortMappingSnapshot> {
    return this.queue.run(async () => {
      this.state.publish({ state: 'starting', mappings: this.listMappings() });
      try {
        const gateway = await this.ensureGateway();
        let mapped: PortMappingDto | undefined;
        for await (const result of gateway.mapAll(privatePort, {
          protocol: 'TCP', externalPort: publicPort, description: 'Burrow', ttl: 30 * 60 * 1_000,
        })) {
          mapped = { publicPort: result.externalPort, privatePort: result.internalPort, externalIp: result.externalHost };
          break;
        }
        if (!mapped) throw new Error('Gateway returned no mapping');
        this.mappings.set(mapped.publicPort, mapped);
        return this.state.publish({ state: 'active', mappings: this.listMappings() });
      } catch (error) {
        return this.state.publish({ state: 'failed', mappings: this.listMappings(), diagnostic: diagnostic('UPNP_MAPPING_FAILED', 'UPnP port mapping failed', error) });
      }
    });
  }

  public unmapTcp(publicPort: number): Promise<PortMappingSnapshot> {
    return this.queue.run(async () => {
      const mapping = this.mappings.get(publicPort);
      if (!mapping || !this.gateway) return this.state.get();
      try {
        await this.gateway.unmap(mapping.privatePort);
        this.mappings.delete(publicPort);
        return this.state.publish({ state: this.mappings.size ? 'active' : 'idle', mappings: this.listMappings() });
      } catch (error) {
        return this.state.publish({ state: 'failed', mappings: this.listMappings(), diagnostic: diagnostic('UPNP_UNMAP_FAILED', 'UPnP port unmapping failed', error) });
      }
    });
  }

  public stop(): Promise<PortMappingSnapshot> {
    return this.queue.run(async () => {
      const gateway = this.gateway;
      if (!gateway) {
        this.client = undefined;
        this.gatewayPromise = undefined;
        this.mappings.clear();
        return this.state.get().state === 'idle' ? this.state.get() : this.state.publish({ state: 'idle', mappings: [] });
      }
      this.state.publish({ state: 'stopping', mappings: this.listMappings() });
      try {
        await gateway.stop();
        this.gateway = undefined;
        this.gatewayPromise = undefined;
        this.client = undefined;
        this.mappings.clear();
        return this.state.publish({ state: 'idle', mappings: [] });
      } catch (error) {
        return this.state.publish({ state: 'failed', mappings: this.listMappings(), diagnostic: diagnostic('UPNP_CLEANUP_FAILED', 'UPnP cleanup was incomplete', error) });
      }
    });
  }

  private ensureGateway(): Promise<Gateway> {
    if (this.gateway) return Promise.resolve(this.gateway);
    if (this.gatewayPromise) return this.gatewayPromise;
    this.client ??= this.createClient();
    this.gatewayPromise = (async () => {
      for await (const gateway of this.client!.findGateways({ signal: AbortSignal.timeout(8_000) })) {
        this.gateway = gateway;
        return gateway;
      }
      throw new Error('No gateway found');
    })().catch((error) => {
      this.gatewayPromise = undefined;
      throw error;
    });
    return this.gatewayPromise;
  }

  private listMappings(): PortMappingDto[] { return [...this.mappings.values()].map((mapping) => ({ ...mapping })); }
}
