/**
 * DEV-ONLY: simulated Nova Poshta shipments for verifying the Logistics
 * dashboard locally (map dots, statuses, costs, activities, tracking panel).
 * A real waybill is impossible without NOVAPOSHTA_API_KEY in the local env,
 * so this recreates exactly the data shape the provider + sync produce.
 *
 * Creates on the 4 most recent orders:
 *   #1 → pending   (NP method data on the order, no waybill)   Одеса
 *   #2 → created   (waybill, status 1)                          Київ
 *   #3 → in transit(waybill, status 4)                          Львів
 *   #4 → delivered (waybill, status 9)                          Харків
 *
 * Run:     npx medusa exec ./np-test-shipments.ts
 * Remove:  npx medusa exec ./np-test-shipments.ts cleanup
 */
import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

const FIXTURES = [
  {
    ttn: "20450000000101",
    city: "Київ",
    cost: "80",
    status: "Відправник самостійно створив цю накладну, але ще не надав її до відправки",
    code: "1",
  },
  {
    ttn: "20450000000102",
    city: "Львів",
    cost: "95",
    status: "Відправлення прямує до міста одержувача",
    code: "4",
  },
  {
    ttn: "20450000000103",
    city: "Харків",
    cost: "110",
    status: "Відправлення отримано",
    code: "9",
  },
]

export default async function npTestShipments({ container, args }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const remoteLink = container.resolve(ContainerRegistrationKeys.REMOTE_LINK)
  const fulfillmentModule = container.resolve(Modules.FULFILLMENT)
  const orderModule = container.resolve(Modules.ORDER)

  if (args?.includes("cleanup")) {
    const { data } = await query.graph({
      entity: "fulfillment",
      fields: ["id", "data"],
      pagination: { take: 500, skip: 0 },
    })
    const fixtures = (data as { id: string; data?: Record<string, unknown> }[]).filter(
      (f) => f.data?.np_test_fixture === true
    )
    for (const f of fixtures) {
      await remoteLink
        .dismiss({
          [Modules.ORDER]: { order_id: String(f.data?.np_fixture_order) },
          [Modules.FULFILLMENT]: { fulfillment_id: f.id },
        })
        .catch(() => {})
      await fulfillmentModule.cancelFulfillment(f.id).catch(() => {})
      await fulfillmentModule.deleteFulfillment(f.id)
      logger.info(`Removed fixture fulfillment ${f.id}`)
    }
    // Strip the pending-order method data we added.
    const methods = await orderModule.listOrderShippingMethods(
      {},
      { select: ["id", "data"], take: 500 }
    )
    let cleaned = 0
    for (const m of methods) {
      const d = (m.data ?? {}) as Record<string, unknown>
      if (d.np_test_fixture === true) {
        await orderModule.updateOrderShippingMethods([{ id: m.id, data: {} }])
        cleaned++
      }
    }
    logger.info(`Cleanup done: ${fixtures.length} fulfillments, ${cleaned} pending methods`)
    return
  }

  const { data: orders } = await query.graph({
    entity: "order",
    fields: ["id", "display_id", "shipping_methods.id"],
    pagination: { take: 4, skip: 0, order: { created_at: "DESC" } },
  })
  if (orders.length < 4) throw new Error("Need at least 4 local orders")
  const { data: locations } = await query.graph({
    entity: "stock_location",
    fields: ["id"],
    pagination: { take: 1, skip: 0 },
  })
  const locationId = (locations[0] as { id: string }).id

  // Order #1 → pending: NP method data only, no waybill.
  const pendingOrder = orders[0] as {
    id: string
    display_id: number
    shipping_methods?: { id: string }[]
  }
  const methodId = pendingOrder.shipping_methods?.[0]?.id
  if (methodId) {
    await orderModule.updateOrderShippingMethods([
      {
        id: methodId,
        data: {
          np_test_fixture: true,
          np_kind: "warehouse",
          np_city_name: "Одеса",
          np_warehouse_description: "Відділення №1 (тест)",
        },
      },
    ])
    logger.info(`Order #${pendingOrder.display_id} → pending (Одеса)`)
  }

  // Orders #2..#4 → waybills in three states.
  for (let i = 0; i < FIXTURES.length; i++) {
    const fx = FIXTURES[i]
    const order = orders[i + 1] as { id: string; display_id: number }
    const daysAgo = (FIXTURES.length - i) * 1
    const createdAt = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000)
    const fulfillment = await fulfillmentModule.createFulfillment({
      location_id: locationId,
      provider_id: "manual_manual",
      delivery_address: {},
      items: [],
      labels: [
        {
          tracking_number: fx.ttn,
          tracking_url: `https://novaposhta.ua/tracking/?cargo_number=${fx.ttn}`,
          label_url: "",
        },
      ],
      data: {
        np_test_fixture: true,
        np_fixture_order: order.id,
        np_ttn: fx.ttn,
        np_document_ref: `test-ref-${fx.ttn}`,
        np_kind: "warehouse",
        np_city_name: fx.city,
        np_delivery_cost: fx.cost,
      },
      metadata: {
        np_status: fx.status,
        np_status_code: fx.code,
        np_synced_at: new Date().toISOString(),
      },
      created_at: createdAt,
    } as Parameters<typeof fulfillmentModule.createFulfillment>[0])
    await remoteLink.create({
      [Modules.ORDER]: { order_id: order.id },
      [Modules.FULFILLMENT]: { fulfillment_id: fulfillment.id },
    })
    logger.info(
      `Order #${order.display_id} → ТТН ${fx.ttn} (${fx.city}, статус ${fx.code})`
    )
  }
  logger.info("Test shipments ready. Remove with: npx medusa exec ./np-test-shipments.ts cleanup")
}
