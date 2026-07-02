// Reusable form row — stacked label above field (modern, mobile-friendly)
export default function FormRow({ label, children }) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && <label className="text-sm font-medium text-foreground">{label}</label>}
      <div>{children}</div>
    </div>
  )
}
