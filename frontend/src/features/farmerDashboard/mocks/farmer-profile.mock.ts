/**
 * Demo Farmer Profile Data — clearly labelled.
 *
 * Used by the new Farmer Profile screen. Where the auth store already
 * provides uid/email/displayName, we still fill in the agricultural
 * attributes (village, primary crops, FPO membership, land size) as
 * demo data.
 */

import type { FarmerProfile } from "../types";
import { DEMO_FARMER_UID } from "./lots.mock";

const joined = new Date();
joined.setMonth(joined.getMonth() - 14);

export const DEMO_FARMER_PROFILE: FarmerProfile = {
  uid: DEMO_FARMER_UID,
  name: "Ramesh Kumar",
  email: "ramesh.kumar@demo.agriseva.ai",
  phone: "+91 9XXXXXXXXX",
  state: "Karnataka",
  district: "Kolar",
  village: "Srinivasapura",
  preferredLanguage: "en-IN",
  primaryCrops: ["Tomato", "Onion", "Maize", "Chilli"],
  preferredMarkets: ["Kolar Mandi", "Bangalore Mandi", "Azadpur Mandi"],
  fpoName: "Krishna Valley FPO",
  fpoMember: true,
  landSizeAcres: 4.5,
  joinedAt: joined.toISOString(),
  verificationStatus: "verified",
  isDemo: true,
};
