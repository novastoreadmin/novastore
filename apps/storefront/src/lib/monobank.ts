import { sdk } from "./medusa";

/**
 * Saved Monobank cards for the logged-in customer. Cards are tokenized and
 * stored by Monobank (wallet keyed by the customer id) — we only ever see the
 * token and the masked PAN. Requests are authenticated with the customer JWT
 * the SDK attaches automatically.
 */

export type SavedCard = {
  cardToken: string;
  maskedPan: string;
  country?: string;
};

export async function getSavedCards(): Promise<SavedCard[]> {
  try {
    const { cards } = await sdk.client.fetch<{ cards: SavedCard[] }>(
      "/store/monobank/cards"
    );
    return cards ?? [];
  } catch {
    // Guests / expired sessions / upstream hiccups → just no one-click option.
    return [];
  }
}

export async function deleteSavedCard(cardToken: string): Promise<void> {
  await sdk.client.fetch(
    `/store/monobank/cards?card_token=${encodeURIComponent(cardToken)}`,
    { method: "DELETE" }
  );
}
