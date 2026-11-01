/**
 * Utility to convert numeric amounts into words, respecting currency-specific
 * major units and fractional subunits (e.g. OMR -> Baisa, AED -> Fils, USD -> Cents).
 */

const ONES = [
  "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
  "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
  "Seventeen", "Eighteen", "Nineteen",
];

const TENS = [
  "", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety",
];

function convertGroup(n: number): string {
  let str = "";
  if (n >= 100) {
    str += ONES[Math.floor(n / 100)] + " Hundred ";
    n %= 100;
  }
  if (n >= 20) {
    str += TENS[Math.floor(n / 10)] + (n % 10 > 0 ? " " + ONES[n % 10] : "") + " ";
  } else if (n > 0) {
    str += ONES[n] + " ";
  }
  return str.trim();
}

export function integerToWords(num: number): string {
  if (num === 0) return "Zero";
  if (num < 0) return "Minus " + integerToWords(Math.abs(num));

  num = Math.floor(num);
  let words = "";

  const billions = Math.floor(num / 1_000_000_000);
  num %= 1_000_000_000;
  const millions = Math.floor(num / 1_000_000);
  num %= 1_000_000;
  const thousands = Math.floor(num / 1_000);
  const remainder = num % 1_000;

  if (billions > 0) {
    words += convertGroup(billions) + " Billion ";
  }
  if (millions > 0) {
    words += convertGroup(millions) + " Million ";
  }
  if (thousands > 0) {
    words += convertGroup(thousands) + " Thousand ";
  }
  if (remainder > 0) {
    words += convertGroup(remainder);
  }

  return words.trim();
}

interface CurrencyUnit {
  majorSingle: string;
  majorPlural: string;
  minorSingle: string;
  minorPlural: string;
  decimals: number;
}

const CURRENCY_DICTIONARY: Record<string, CurrencyUnit> = {
  OMR: {
    majorSingle: "Omani Rial",
    majorPlural: "Omani Rials",
    minorSingle: "Baisa",
    minorPlural: "Baisa",
    decimals: 3,
  },
  AED: {
    majorSingle: "UAE Dirham",
    majorPlural: "UAE Dirhams",
    minorSingle: "Fils",
    minorPlural: "Fils",
    decimals: 2,
  },
  SAR: {
    majorSingle: "Saudi Riyal",
    majorPlural: "Saudi Riyals",
    minorSingle: "Halala",
    minorPlural: "Halalas",
    decimals: 2,
  },
  KWD: {
    majorSingle: "Kuwaiti Dinar",
    majorPlural: "Kuwaiti Dinars",
    minorSingle: "Fils",
    minorPlural: "Fils",
    decimals: 3,
  },
  BHD: {
    majorSingle: "Bahraini Dinar",
    majorPlural: "Bahraini Dinars",
    minorSingle: "Fils",
    minorPlural: "Fils",
    decimals: 3,
  },
  QAR: {
    majorSingle: "Qatari Riyal",
    majorPlural: "Qatari Riyals",
    minorSingle: "Dirham",
    minorPlural: "Dirhams",
    decimals: 2,
  },
  USD: {
    majorSingle: "US Dollar",
    majorPlural: "US Dollars",
    minorSingle: "Cent",
    minorPlural: "Cents",
    decimals: 2,
  },
  INR: {
    majorSingle: "Indian Rupee",
    majorPlural: "Indian Rupees",
    minorSingle: "Paisa",
    minorPlural: "Paise",
    decimals: 2,
  },
  EUR: {
    majorSingle: "Euro",
    majorPlural: "Euros",
    minorSingle: "Cent",
    minorPlural: "Cents",
    decimals: 2,
  },
  GBP: {
    majorSingle: "Pound Sterling",
    majorPlural: "Pounds Sterling",
    minorSingle: "Penny",
    minorPlural: "Pence",
    decimals: 2,
  },
};

/**
 * Returns formatted amount in words according to the currency conventions.
 * E.g. (10513.5, "OMR") -> "Ten Thousand Five Hundred Thirteen Omani Rials and Five Hundred Baisa Only"
 */
export function amountInWords(amount: number, currCode: string = "OMR"): string {
  if (amount == null || isNaN(amount) || amount === 0) {
    const unit = CURRENCY_DICTIONARY[currCode?.toUpperCase()] || { majorPlural: currCode || "Units" };
    return `Zero ${unit.majorPlural} Only`;
  }

  const isNegative = amount < 0;
  const absAmount = Math.abs(amount);
  const code = (currCode || "OMR").toUpperCase();
  const unit = CURRENCY_DICTIONARY[code] || {
    majorSingle: code,
    majorPlural: code,
    minorSingle: "Cent",
    minorPlural: "Cents",
    decimals: 2,
  };

  const whole = Math.floor(absAmount);
  const factor = Math.pow(10, unit.decimals);
  const fraction = Math.round((absAmount - whole) * factor);

  let result = "";
  if (isNegative) {
    result += "Minus ";
  }

  // Major part
  if (whole > 0) {
    const wholeWords = integerToWords(whole);
    const majorUnit = whole === 1 ? unit.majorSingle : unit.majorPlural;
    result += `${wholeWords} ${majorUnit}`;
  }

  // Minor part
  if (fraction > 0) {
    const fractionWords = integerToWords(fraction);
    const minorUnit = fraction === 1 ? unit.minorSingle : unit.minorPlural;
    if (whole > 0) {
      result += ` and ${fractionWords} ${minorUnit}`;
    } else {
      result += `${fractionWords} ${minorUnit}`;
    }
  }

  return `${result.trim()} Only`;
}

