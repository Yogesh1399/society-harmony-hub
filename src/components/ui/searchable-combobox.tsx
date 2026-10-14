import * as React from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

export interface ComboboxOption {
  value: string;
  label: string;
  /** Extra metadata shown in muted text after label */
  hint?: string;
  /** Concatenated search text. Defaults to `${label} ${hint}` */
  searchText?: string;
}

interface SearchableComboboxProps {
  options: ComboboxOption[];
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  /** Allow free-text values not in the options list */
  allowFreeText?: boolean;
  /** Render a custom label for the trigger when `allowFreeText` is true */
  freeTextLabel?: (value: string) => string;
  className?: string;
  disabled?: boolean;
}

/**
 * Reusable Combobox built on Popover + Command.
 * Replaces hacky <Select> with embedded <Input> patterns that violate
 * focus/keyboard accessibility and cause hooks-order issues.
 */
export function SearchableCombobox({
  options,
  value,
  onChange,
  placeholder = 'Select...',
  searchPlaceholder = 'Search...',
  emptyText = 'No results found.',
  allowFreeText = false,
  freeTextLabel,
  className,
  disabled,
}: SearchableComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');

  const selected = options.find((o) => o.value === value);
  const displayLabel = selected
    ? selected.hint
      ? `${selected.label} · ${selected.hint}`
      : selected.label
    : value && allowFreeText
      ? (freeTextLabel ? freeTextLabel(value) : value)
      : '';

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            'w-full h-12 justify-between font-normal',
            !displayLabel && 'text-muted-foreground',
            className
          )}
        >
          <span className="truncate text-left">{displayLabel || placeholder}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command
          filter={(itemValue, searchValue) => {
            const opt = options.find((o) => o.value === itemValue);
            const haystack = (opt?.searchText ?? `${opt?.label ?? ''} ${opt?.hint ?? ''}`).toLowerCase();
            return haystack.includes(searchValue.toLowerCase()) ? 1 : 0;
          }}
        >
          <CommandInput
            placeholder={searchPlaceholder}
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty>
              {allowFreeText && search ? (
                <button
                  type="button"
                  className="w-full text-left px-2 py-1.5 text-sm hover:bg-accent rounded-sm"
                  onClick={() => {
                    onChange(search);
                    setOpen(false);
                    setSearch('');
                  }}
                >
                  Use "<span className="font-medium">{search}</span>"
                </button>
              ) : (
                <span className="block py-3 text-center text-sm text-muted-foreground">
                  {emptyText}
                </span>
              )}
            </CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.value}
                  onSelect={(currentValue) => {
                    onChange(currentValue);
                    setOpen(false);
                    setSearch('');
                  }}
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4',
                      value === option.value ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  <span className="flex-1 truncate">
                    <span className="font-medium">{option.label}</span>
                    {option.hint && (
                      <span className="text-muted-foreground ml-2 text-xs">· {option.hint}</span>
                    )}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
