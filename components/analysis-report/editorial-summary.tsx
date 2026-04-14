export function EditorialSummary({ text }: { text: string }) {
  if (!text) return null;
  return (
    <section className="font-display text-lg md:text-xl leading-relaxed text-foreground/90 my-8 max-w-[65ch]">
      {text}
    </section>
  );
}
