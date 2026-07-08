import { InfoPage } from "@/components/info/info-page";

export const metadata = { title: "Питання й відповіді" };

export default function FaqPage() {
  return <InfoPage pageKey="faq" accordion />;
}
