// Empty Card placeholder (previously empty file). Exporting simple wrapper.
export default function Card({ className = "", children, ...props }) {
  return (
    <div className={`bg-white border border-nodea-slate-light rounded p-3 ${className}`} {...props}>
      {children}
    </div>
  );
}
