import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { getMonobankClient } from "../../../../lib/monobank"

/**
 * Saved cards (Monobank wallet) for the logged-in customer.
 * The wallet is keyed by the Medusa customer id, so a customer can only ever
 * see/delete their own cards. Auth is enforced in middlewares.ts.
 *
 * GET    /store/monobank/cards                     → { cards: [{cardToken, maskedPan}] }
 * DELETE /store/monobank/cards?card_token=<token>  → { deleted: true }
 */

export async function GET(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
): Promise<void> {
  const customerId = req.auth_context?.actor_id
  if (!customerId) {
    res.status(401).json({ message: "Not authenticated" })
    return
  }
  try {
    const cards = await getMonobankClient().walletCards(customerId)
    res.json({ cards })
  } catch (error) {
    const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)
    logger.error(
      `[Monobank] wallet list failed for ${customerId}: ${
        error instanceof Error ? error.message : error
      }`
    )
    // An empty wallet is indistinguishable from "wallet id never used" —
    // treat upstream errors as "no saved cards" so checkout still works.
    res.json({ cards: [] })
  }
}

export async function DELETE(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
): Promise<void> {
  const customerId = req.auth_context?.actor_id
  if (!customerId) {
    res.status(401).json({ message: "Not authenticated" })
    return
  }
  const cardToken = req.query.card_token as string | undefined
  if (!cardToken) {
    res.status(400).json({ message: "card_token is required" })
    return
  }
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)
  try {
    const client = getMonobankClient()
    // Ownership check: the token must be in THIS customer's wallet.
    const cards = await client.walletCards(customerId)
    if (!cards.some((c) => c.cardToken === cardToken)) {
      res.status(404).json({ message: "Card not found" })
      return
    }
    await client.deleteWalletCard(cardToken)
    logger.info(`[Monobank] Card ${cardToken.slice(0, 6)}… deleted from wallet ${customerId}`)
    res.json({ deleted: true })
  } catch (error) {
    logger.error(
      `[Monobank] card delete failed for ${customerId}: ${
        error instanceof Error ? error.message : error
      }`
    )
    res.status(502).json({ message: "Could not delete card" })
  }
}
