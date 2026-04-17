import * as React from "react";
import { cn } from "@/lib/utils";

const Tabs = ({ className, value, onValueChange, children }: any) => {
  return (
    <div className={cn("w-full", className)}>
      {React.Children.map(children, (child) => {
        if (React.isValidElement(child)) {
          return React.cloneElement(child, { _selectedValue: value, _onValueChange: onValueChange } as any);
        }
        return child;
      })}
    </div>
  );
};

const TabsList = ({ className, children, _selectedValue, _onValueChange, ...props }: any) => {
  return (
    <div
      className={cn(
        "inline-flex h-9 items-center justify-center rounded-lg bg-secondary p-1 text-muted-foreground",
        className
      )}
      {...props}
    >
      {React.Children.map(children, (child) => {
        if (React.isValidElement(child)) {
          return React.cloneElement(child, { _selectedValue, _onValueChange } as any);
        }
        return child;
      })}
    </div>
  );
};

const TabsTrigger = ({ className, value, children, _selectedValue, _onValueChange, ...props }: any) => {
  const isActive = _selectedValue === value;
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-[13px] font-medium transition-colors focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50",
        isActive
          ? "bg-card text-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground",
        className
      )}
      onClick={() => _onValueChange?.(value)}
      {...props}
    >
      {children}
    </button>
  );
};

const TabsContent = ({ className, value, children, _selectedValue, _onValueChange, ...props }: any) => {
  if (_selectedValue !== value) return null;
  return (
    <div
      className={cn("mt-3", className)}
      {...props}
    >
      {children}
    </div>
  );
};

export { Tabs, TabsList, TabsTrigger, TabsContent };
