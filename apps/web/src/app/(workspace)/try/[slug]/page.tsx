import { GuestConsultation } from "@/components/guest-consultation";
export default async function GuestTrialPage({params}:{params:Promise<{slug:string}>}){const {slug}=await params;return <GuestConsultation slug={slug}/>}
