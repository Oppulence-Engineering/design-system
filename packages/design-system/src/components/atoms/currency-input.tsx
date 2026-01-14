import { NumericFormat, type NumericFormatProps } from "react-number-format";

import { Input } from "./input";

export function CurrencyInput({
  thousandSeparator = true,
  ...props
}: Omit<NumericFormatProps, "className">) {
  return (
    <NumericFormat
      thousandSeparator={thousandSeparator}
      customInput={Input}
      {...props}
    />
  );
}
