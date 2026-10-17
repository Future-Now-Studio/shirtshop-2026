/**
 * Invisible trap field for spam bots: humans never see or fill it, simple
 * form bots do. Forms check `isBot(form)` and silently skip the insert.
 */
export function Honeypot() {
  return (
    <div aria-hidden="true" className="absolute -left-[10000px] h-px w-px overflow-hidden">
      <label>
        Website
        <input type="text" name="website" tabIndex={-1} autoComplete="off" defaultValue="" />
      </label>
    </div>
  );
}

export function isBot(form: HTMLFormElement | null | undefined): boolean {
  const field = form?.elements.namedItem("website") as HTMLInputElement | null;
  return !!field?.value;
}
