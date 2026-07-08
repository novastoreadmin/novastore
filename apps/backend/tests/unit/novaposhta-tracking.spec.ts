import { afterEach, describe, expect, it, vi } from "vitest"
import { NovaPoshtaClient } from "../../src/modules/fulfillment-novaposhta/client"

/**
 * trackDocuments (TrackingDocument.getStatusDocuments) against a mocked NP
 * API: request shape, ≤100 batching, response mapping and error surfacing.
 */

const makeClient = () =>
  new NovaPoshtaClient({
    apiKey: "test-key",
    senderCityName: "Київ",
    senderWarehouseNumber: "1",
    senderPhone: "0671234567",
  })

const npOk = (data: unknown[]) => ({
  ok: true,
  json: async () => ({ success: true, data, errors: [], warnings: [] }),
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("NovaPoshtaClient.trackDocuments", () => {
  it("sends TrackingDocument.getStatusDocuments with the api key and maps the response", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      npOk([
        {
          Number: "204514",
          RefEW: "ref-1",
          Status: "Відправлення отримано",
          StatusCode: 9,
          RecipientFullName: "Шевченко Тарас",
          CityRecipient: "Київ",
          WarehouseRecipient: "Відділення №1",
          ScheduledDeliveryDate: "04.07.2026",
          DocumentCost: "80",
          DocumentWeight: "1",
        },
      ])
    )
    vi.stubGlobal("fetch", fetchMock)

    const result = await makeClient().trackDocuments(["204514"])

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body).toMatchObject({
      apiKey: "test-key",
      modelName: "TrackingDocument",
      calledMethod: "getStatusDocuments",
      methodProperties: { Documents: [{ DocumentNumber: "204514", Phone: "" }] },
    })

    const doc = result.get("204514")!
    expect(doc).toMatchObject({
      ttn: "204514",
      ref: "ref-1",
      status: "Відправлення отримано",
      statusCode: "9",
      recipientFullName: "Шевченко Тарас",
      warehouseRecipient: "Відділення №1",
      documentCost: "80",
    })
  })

  it("splits more than 100 ТТН into multiple batches and dedupes", async () => {
    const fetchMock = vi.fn().mockResolvedValue(npOk([]))
    vi.stubGlobal("fetch", fetchMock)

    const ttns = Array.from({ length: 150 }, (_, i) => `TTN${i}`)
    await makeClient().trackDocuments([...ttns, ...ttns]) // duplicates collapse

    expect(fetchMock).toHaveBeenCalledTimes(2)
    const first = JSON.parse(fetchMock.mock.calls[0][1].body)
    const second = JSON.parse(fetchMock.mock.calls[1][1].body)
    expect(first.methodProperties.Documents).toHaveLength(100)
    expect(second.methodProperties.Documents).toHaveLength(50)
  })

  it("skips empty values and makes no request for an empty list", async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)
    const result = await makeClient().trackDocuments(["", ""])
    expect(result.size).toBe(0)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("throws a readable error when NP responds success:false", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: false, data: [], errors: ["API key expired"], warnings: [] }),
      })
    )
    await expect(makeClient().trackDocuments(["204514"])).rejects.toThrow(
      /TrackingDocument\.getStatusDocuments failed: API key expired/
    )
  })
})
