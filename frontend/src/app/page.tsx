import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Hero } from "@/components/landing/Hero";
import { Categories } from "@/components/landing/Categories";
import { Journey } from "@/components/landing/Journey";
import { Community } from "@/components/landing/Community";
import { ImpactPreview } from "@/components/landing/ImpactPreview";
import { FinalCta } from "@/components/landing/FinalCta";

export default function Home() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <Categories />
        <Journey />
        <Community />
        <ImpactPreview />
        <FinalCta />
      </main>
      <Footer />
    </>
  );
}
