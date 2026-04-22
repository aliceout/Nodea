import type { HTMLAttributes, PropsWithChildren } from 'react';

type CardProps = PropsWithChildren<HTMLAttributes<HTMLDivElement>>;

export default function Card({ className = '', children, ...props }: CardProps) {
  return (
    <div
      className={`bg-white border border-nodea-slate-light rounded p-3 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
