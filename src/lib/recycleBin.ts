export const RECYCLE_BIN_KEY = 'bakr_pro_recycle_bin_v1';
export const RECYCLE_BIN_EVENT = 'bakr-pro-recycle-bin-updated';

export type RecycleBinItem = {
  id: string;
  entityType: string;
  title: string;
  subtitle?: string;
  sourceStorageKey: string;
  payload: unknown;
  originalIndex?: number;
  deletedAt: string;
};

type AddToRecycleBinInput = {
  entityType: string;
  title: string;
  subtitle?: string;
  sourceStorageKey: string;
  payload: unknown;
  originalIndex?: number;
};

function makeId() {
  try {
    if (
      typeof crypto !== 'undefined' &&
      typeof crypto.randomUUID === 'function'
    ) {
      return crypto.randomUUID();
    }
  } catch {}

  return `trash-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

function notifyRecycleBinUpdated() {
  try {
    window.dispatchEvent(
      new CustomEvent(RECYCLE_BIN_EVENT)
    );
  } catch {}
}

export function readRecycleBin(): RecycleBinItem[] {
  try {
    const raw = localStorage.getItem(RECYCLE_BIN_KEY);

    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);

    return Array.isArray(parsed)
      ? parsed
      : [];
  } catch {
    return [];
  }
}

export function writeRecycleBin(
  items: RecycleBinItem[]
) {
  localStorage.setItem(
    RECYCLE_BIN_KEY,
    JSON.stringify(items)
  );

  notifyRecycleBinUpdated();
}

export function addToRecycleBin(
  input: AddToRecycleBinInput
) {
  const item: RecycleBinItem = {
    id: makeId(),
    entityType: input.entityType,
    title: input.title || 'عنصر محذوف',
    subtitle: input.subtitle || '',
    sourceStorageKey: input.sourceStorageKey,
    payload: input.payload,
    originalIndex: input.originalIndex,
    deletedAt: new Date().toISOString(),
  };

  writeRecycleBin([
    item,
    ...readRecycleBin(),
  ]);

  return item;
}

export function deleteRecycleItemPermanently(
  id: string
) {
  writeRecycleBin(
    readRecycleBin().filter(
      item => item.id !== id
    )
  );
}

export function emptyRecycleBin() {
  writeRecycleBin([]);
}

export function restoreRecycleItem(
  id: string
): { ok: true } | { ok: false; message: string } {
  const items = readRecycleBin();

  const item = items.find(
    entry => entry.id === id
  );

  if (!item) {
    return {
      ok: false,
      message: 'العنصر غير موجود',
    };
  }

  try {
    const raw = localStorage.getItem(
      item.sourceStorageKey
    );

    let current: unknown = [];

    if (raw) {
      try {
        current = JSON.parse(raw);
      } catch {
        current = [];
      }
    }

    if (Array.isArray(current)) {
      const next = [...current];

      const index =
        typeof item.originalIndex === 'number'
          ? Math.max(
              0,
              Math.min(
                item.originalIndex,
                next.length
              )
            )
          : next.length;

      next.splice(
        index,
        0,
        item.payload
      );

      localStorage.setItem(
        item.sourceStorageKey,
        JSON.stringify(next)
      );
    } else {
      localStorage.setItem(
        item.sourceStorageKey,
        JSON.stringify(item.payload)
      );
    }

    writeRecycleBin(
      items.filter(
        entry => entry.id !== id
      )
    );

    return { ok: true };
  } catch {
    return {
      ok: false,
      message: 'تعذر استعادة العنصر',
    };
  }
}
