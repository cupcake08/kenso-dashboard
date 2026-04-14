"use client";
import { motion } from "framer-motion";
import { ReportHeader } from "./report-header";
import { HeroLead } from "./hero-lead";
import { EditorialSummary } from "./editorial-summary";
import { SectionRenderer } from "./section-renderer";
import type { AnalysisResultV2 } from "@/types/analysis";

const DEFAULT_SECTION_ORDER = [
  "at_a_glance",
  "notable_moments",
  "worth_attention",
  "deep_dive",
  "recommendations",
];

const container = {
  initial: {},
  animate: { transition: { staggerChildren: 0.04, delayChildren: 0.1 } },
};
const item = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.28, ease: [0.16, 1, 0.3, 1] } },
};

export function ReportShell({ result }: { result: AnalysisResultV2 }) {
  const sections =
    result.sectionOrder?.length ? result.sectionOrder : DEFAULT_SECTION_ORDER;

  return (
    <motion.article
      className="analysis-report max-w-3xl mx-auto p-6"
      initial="initial"
      animate="animate"
      variants={container}
    >
      <motion.div variants={item}>
        <ReportHeader result={result} />
      </motion.div>
      <motion.div variants={item}>
        <HeroLead result={result} />
      </motion.div>
      <motion.div variants={item}>
        <EditorialSummary text={result.summary} />
      </motion.div>
      {sections.map((key) => (
        <motion.div key={key} variants={item}>
          <SectionRenderer section={key} result={result} />
        </motion.div>
      ))}
    </motion.article>
  );
}
