export default function SearchInput({ value, onChange, placeholder = 'Search', className = '' }) {
  return (
    <div className={`search-input ${className}`}>
      <input
        type="text"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="flex-1 outline-none text-sm text-hh-text placeholder-hh-placeholder bg-transparent"
      />
      <svg className="w-4 h-4 text-hh-placeholder flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
    </div>
  )
}
