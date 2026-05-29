import { Button } from "react-email";

type EmailButtonProps = {
  href: string;
  children: React.ReactNode;
  className?: string;
};

export function EmailButton({ href, children, className = "" }: EmailButtonProps) {
  return (
    <Button
      href={href}
      className={`bg-brand font-14 font-inter text-fg-inverted mt-[10px] block h-10 w-full border-none p-0 text-center font-normal no-underline shadow-none ${className}`.trim()}
      style={{ lineHeight: "40px" }}
    >
      {children}
    </Button>
  );
}
