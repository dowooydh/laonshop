import { CATALOG_ADDITIONS, CATALOG_ADDITION_VERSION, type CatalogAdditionDraft } from "@/prisma/catalog-additions";

export type ExistingCatalogProduct = {
  id: string; name: string; gender: string | null; category: string | null;
};

export function catalogDraftId(draft: CatalogAdditionDraft) {
  return `catalog-draft-${CATALOG_ADDITION_VERSION}-${draft.key}`;
}

export function catalogDraftCreateData(draft: CatalogAdditionDraft, sortOrder: number) {
  if (!Number.isSafeInteger(draft.proposedPrice) || draft.proposedPrice <= 0) throw new Error("신규 상품의 제안 가격을 확인해 주세요.");
  return {
    id: catalogDraftId(draft), name: draft.name, gender: draft.gender, category: draft.category,
    description: "판매 준비 중인 신규 셀렉션 초안입니다. 공급 상품·사진·실측·판매가·재고 검수 전에는 판매하지 않습니다.",
    price: draft.proposedPrice, sizes: draft.proposedSizes, imageUrl: null, active: false, stock: 0, sortOrder,
  };
}

export function planCatalogDraftInsert(existing: ExistingCatalogProduct[]) {
  const byId = new Map(existing.map((product) => [product.id, product]));
  const byName = new Set(existing.map((product) => `${product.gender}|${product.name}`));
  const insert: CatalogAdditionDraft[] = [];
  const skipped: string[] = [];
  const conflicts: string[] = [];
  const keys = new Set<string>();
  const names = new Set<string>();
  for (const draft of CATALOG_ADDITIONS) {
    const identity = `${draft.gender}|${draft.name}`;
    if (keys.has(draft.key) || names.has(identity)) throw new Error("신규 상품 초안의 키 또는 이름이 중복됐습니다.");
    keys.add(draft.key); names.add(identity);
    const sameId = byId.get(catalogDraftId(draft));
    if (sameId && (sameId.name !== draft.name || sameId.gender !== draft.gender || sameId.category !== draft.category)) {
      conflicts.push(draft.key);
    } else if (sameId || byName.has(identity)) {
      skipped.push(draft.key);
    } else {
      insert.push(draft);
    }
  }
  return { version: CATALOG_ADDITION_VERSION, proposed: CATALOG_ADDITIONS.length, insert, skipped, conflicts };
}
