import { parse } from "csv-parse/sync"

/**
 * Parses NOVA's manually-exported ITsellOPT wholesale/dropship price list.
 *
 * Source: logged-in "Прайс лист" export from itsellopt.ua (an .xls the ops
 * team re-saves as CSV before handing it to NOVA - see docs, no code touches
 * the raw .xls). Unlike the public YML feed (`itsellopt-feed.ts`, RRP only),
 * this file carries the real cost tiers NOVA actually pays.
 *
 * The export has a few title/metadata rows before the real header, and
 * "section" rows (brand/model group labels with no product code) mixed into
 * the data - both are skipped.
 */

export type ItselloptAvailability = "in_stock" | "low_stock" | "unknown"

export type ItselloptPriceListRow = {
  /** Same "00000085340_1" format as the public feed's offer id. */
  code: string
  accessoryType: string
  brand: string
  nomenclature: string
  characteristic: string
  availability: ItselloptAvailability
  availabilityRaw: string
  photoUrl: string
  /** Wholesale cost tiers, in USD. */
  wholesaleDealerUsd: number
  wholesaleVipUsd: number
  wholesaleUsd: number
  /** True dropship cost (what NOVA nets after reconciliation), in UAH. */
  dropshipUah: number
  /** Recommended retail price for dropship orders, in UAH. */
  dropshipRrpUah: number
  link: string
}

const HEADER_CODE_LABEL = "Код товару"

const AVAILABILITY_MAP: Record<string, ItselloptAvailability> = {
  "В наявності": "in_stock",
  "Закінчується": "low_stock",
}

function toNumber(value: string | undefined): number {
  if (!value) return 0
  const n = Number(value.replace(",", "."))
  return Number.isFinite(n) ? n : 0
}

/** Pure parser - no file I/O, safe to unit test against a fixture string. */
export function parseItselloptPriceListCsv(csv: string): ItselloptPriceListRow[] {
  const rows: string[][] = parse(csv, {
    skip_empty_lines: true,
    relax_column_count: true,
  })

  const headerIndex = rows.findIndex((row) => row[0]?.trim() === HEADER_CODE_LABEL)
  if (headerIndex === -1) {
    throw new Error(
      `ITsellOPT price list CSV has no "${HEADER_CODE_LABEL}" header row - unexpected export format`
    )
  }

  const result: ItselloptPriceListRow[] = []
  for (const row of rows.slice(headerIndex + 1)) {
    const code = row[0]?.trim() ?? ""
    if (!code) continue // section/group header row, or trailing blank row

    const availabilityRaw = row[5]?.trim() ?? ""
    result.push({
      code,
      accessoryType: row[1]?.trim() ?? "",
      brand: row[2]?.trim() ?? "",
      nomenclature: row[3]?.trim() ?? "",
      characteristic: row[4]?.trim() ?? "",
      availability: AVAILABILITY_MAP[availabilityRaw] ?? "unknown",
      availabilityRaw,
      photoUrl: row[6]?.trim() ?? "",
      wholesaleDealerUsd: toNumber(row[7]),
      wholesaleVipUsd: toNumber(row[8]),
      wholesaleUsd: toNumber(row[9]),
      dropshipUah: toNumber(row[10]),
      dropshipRrpUah: toNumber(row[11]),
      link: row[13]?.trim() ?? "",
    })
  }

  return result
}

export function findPriceListRowsByCode(
  rows: ItselloptPriceListRow[],
  code: string
): ItselloptPriceListRow[] {
  return rows.filter((r) => r.code === code)
}

/** Builds a code -> row lookup for joining against `itsellopt-feed.ts` offers. */
export function indexPriceListByCode(
  rows: ItselloptPriceListRow[]
): Map<string, ItselloptPriceListRow> {
  return new Map(rows.map((r) => [r.code, r]))
}
