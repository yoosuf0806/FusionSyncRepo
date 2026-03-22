// Reusable two-column form row — Label | Input/Value
export default function FormRow({ label, children, labelWidth = 'w-48' }) {
  return (
    <div className="flex gap-2 items-stretch">
      <div className={`form-label flex-shrink-0 ${labelWidth}`}>{label}</div>
      <div className="flex-1">{children}</div>
    </div>
  )
}
