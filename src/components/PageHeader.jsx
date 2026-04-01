export default function PageHeader({ title }) {
  return (
    <div className="flex justify-center mb-6">
      <div className="page-title-bar px-12 text-base font-medium">{title}</div>
    </div>
  )
}
