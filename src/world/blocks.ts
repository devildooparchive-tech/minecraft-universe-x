/**
 * BlockRegistry — data-driven block definitions.
 *
 * Architecture rule: NO block types exist in code. Every block comes from
 * data/blocks/*.json so content grows without touching the engine.
 */

export interface BlockDef {
  id: number;
  name: string;
  solid: boolean;
  transparent: boolean;
  texture: string | null;
  color?: string;
  hardness?: number;
  liquid?: boolean;
  lightEmission?: number;
  [key: string]: unknown; // extensible via JSON without engine changes
}

export interface BlockFile {
  version: string;
  blocks: BlockDef[];
}

export class BlockRegistry {
  private readonly byIdMap = new Map<number, BlockDef>();
  private readonly byNameMap = new Map<string, BlockDef>();

  constructor(...files: BlockFile[]) {
    for (const file of files) {
      for (const block of file.blocks) {
        if (this.byIdMap.has(block.id)) {
          throw new Error(`Duplicate block id ${block.id} (${block.name})`);
        }
        this.byIdMap.set(block.id, block);
        this.byNameMap.set(block.name, block);
      }
    }
  }

  get count(): number {
    return this.byIdMap.size;
  }

  byId(id: number): BlockDef | undefined {
    return this.byIdMap.get(id);
  }

  byName(name: string): BlockDef | undefined {
    return this.byNameMap.get(name);
  }

  /** Fast solidity check with air-fallback for unregistered ids. */
  solidOrAir(id: number): boolean {
    return this.byIdMap.get(id)?.solid ?? false;
  }

  all(): IterableIterator<BlockDef> {
    return this.byIdMap.values();
  }
}
