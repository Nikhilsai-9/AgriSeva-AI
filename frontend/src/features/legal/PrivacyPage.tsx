import {
  User,
  Cloud,
  Cookie,
  Server,
  Clock,
  Scale,
  ShieldCheck,
  ShoppingBasket,
} from "lucide-react";
import { LegalPage } from "./LegalPage";

const EFFECTIVE = new Date().toISOString().slice(0, 10);

export function PrivacyPage() {
  return (
    <LegalPage
      pageTitle="Privacy Policy"
      description="How AgriSeva-AI collects, uses, and protects farmer data across the AI advisory, voice, and market-price features."
      effectiveDate={EFFECTIVE}
      contactEmail="privacy@agriseva.ai"
      contactJurisdiction="Data is processed under the Digital Personal Data Protection Act, 2023 (India)."
      intro={
        <>
          <p>
            AgriSeva-AI (&ldquo;AgriSeva&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;) is an
            AI-powered advisory platform for Indian farmers. This Privacy
            Policy explains what information we collect when you use the
            AgriSeva-AI website, mobile web app, or voice-calling services,
            and how we use, store, and protect it.
          </p>
          <p>
            By using AgriSeva-AI you agree to the practices described here.
            If you do not agree, please discontinue use of the service.
          </p>
        </>
      }
      sections={[
        {
          heading: "1. Information we collect",
          icon: <User size={18} />,
          paragraphs: [
            "Account data. When you sign in, Firebase Authentication processes your email address, display name, and authentication tokens. We do not see or store your password.",
            "Farmer profile data. Optional profile fields you fill in (state, district, crops grown, language preference) are stored in our database to personalize advisories.",
            "AI interactions. Questions you ask the AgriSeva-AI assistant, the generated answers, and timestamps are logged to improve quality and to provide history. You can delete these from your profile.",
            "Uploaded content. Photos, voice notes, or documents you choose to upload are stored in Google Cloud Storage in encrypted form and are only retained for as long as needed to serve you.",
            "Voice interactions. Voice calls placed through the AgriSeva-AI voice line are transcribed by Sarvam AI for the duration of the call. Transcripts may be retained for quality review; audio recordings are deleted within 30 days unless required for legal hold.",
            "Market data usage. Aggregated queries for market prices (Agmarknet / eNAM) are logged to detect abuse and improve caching. We do not associate these with your identity.",
            "Cookies and local storage. We use strictly-necessary cookies for authentication (Firebase Auth session token) and optional Firebase Analytics cookies only if you grant consent via the cookie banner.",
          ],
        },
        {
          heading: "2. How we use your information",
          icon: <Cloud size={18} />,
          paragraphs: [
            "To operate, secure, and improve AgriSeva-AI \u2014 including AI inference, fraud detection, and crash diagnostics.",
            "To send service-related notifications (price alerts, replies to your questions, grievance status). Marketing communications are sent only with consent.",
            "To comply with applicable law and respond to lawful requests from authorities.",
          ],
        },
        {
          heading: "3. Third-party services",
          icon: <Server size={18} />,
          paragraphs: [
            "Firebase (Google) \u2014 authentication, hosting, optional analytics.",
            "MongoDB Atlas \u2014 primary database.",
            "Google Cloud Storage \u2014 file uploads.",
            "Sarvam AI \u2014 speech-to-text and translation for voice calls.",
            "Plivo \u2014 telephony for the voice helpline.",
            "Government data sources \u2014 Agmarknet, eNAM, IMD, Soil Health Card, myscheme.gov.in \u2014 for market, weather, soil, and scheme data we relay to you. These sources receive no personal data from us.",
          ],
        },
        {
          heading: "4. Cookies and analytics",
          icon: <Cookie size={18} />,
          paragraphs: [
            "We use a strictly-necessary authentication cookie set by Firebase. Non-essential cookies (Firebase Analytics) only load after you click Accept on the cookie banner. You can change your choice at any time from the privacy preferences link in the site footer.",
          ],
        },
        {
          heading: "5. Data retention",
          icon: <Clock size={18} />,
          paragraphs: [
            "Account data: kept while your account is active. Deleted within 30 days of account deletion, except where retention is required by law.",
            "AI interaction history: kept for 12 months unless you delete it sooner.",
            "Voice call transcripts: kept for 90 days unless flagged for quality review.",
            "Uploaded files: deleted within 30 days of account deletion.",
          ],
        },
        {
          heading: "6. Your rights",
          icon: <Scale size={18} />,
          paragraphs: [
            "Access \u2014 request a copy of the personal data we hold about you.",
            "Correction \u2014 ask us to correct inaccurate data.",
            "Erasure \u2014 request deletion of your data, subject to legal retention obligations.",
            "Withdraw consent \u2014 for analytics, marketing, or optional profile fields.",
            "Grievance redressal \u2014 write to our Grievance Officer at the contact email below. We acknowledge within 7 days and resolve within 30 days, per the IT Rules, 2021.",
          ],
        },
        {
          heading: "7. Security",
          icon: <ShieldCheck size={18} />,
          paragraphs: [
            "All traffic is encrypted in transit (TLS 1.2+). Data at rest is encrypted in MongoDB Atlas and Google Cloud Storage. Access is gated by Firebase Authentication on the frontend and by short-lived service-to-service tokens on the backend.",
          ],
        },
        {
          heading: "8. Children",
          icon: <User size={18} />,
          paragraphs: [
            "AgriSeva-AI is intended for adult farmers and agricultural professionals. We do not knowingly collect personal data from anyone under 18. If you believe a minor has created an account, contact us and we will delete it.",
          ],
        },
        {
          heading: "9. Changes to this policy",
          icon: <User size={18} />,
          paragraphs: [
            "We will post material changes here with a new effective date and, where appropriate, notify you by email or in-product notice.",
          ],
        },
        {
          heading: "10. Demo and prototype features",
          icon: <ShoppingBasket size={18} />,
          paragraphs: [
            "Several workflow screens (buyers, lots, offers, logistics, storage, payments, grievances) currently use demo data for prototype evaluation. Data entered into these screens is stored only on the demo backend and is segregated from production records. Real-world integrations with KYC providers, payment gateways, logistics partners, and warehouse APIs are planned but not yet active.",
          ],
        },
      ]}
    />
  );
}

export default PrivacyPage;