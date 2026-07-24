# Canvas Import Package

> **Financial transaction import and processing with field mapping, validation, and transformation**

[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue)](https://www.typescriptlang.org/)
[![Zod](https://img.shields.io/badge/Zod-3.25-blue)](https://zod.dev/)

## 📋 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [API Reference](#api-reference)
- [Usage Examples](#usage-examples)
- [Field Mapping](#field-mapping)
- [Validation](#validation)
- [Error Handling](#error-handling)

## Overview

The Canvas Import package provides comprehensive functionality for importing and processing financial transaction data from various file formats (CSV, Excel, etc.). It includes field mapping, validation, transformation, duplicate detection, and batch processing capabilities.

### Key Benefits

- ✅ **Multi-Format Support** - CSV, Excel, and other formats
- ✅ **Field Mapping** - Flexible field mapping system
- ✅ **Validation** - Comprehensive data validation with Zod
- ✅ **Transformation** - Date parsing, amount formatting, currency conversion
- ✅ **Duplicate Detection** - Prevent duplicate imports
- ✅ **Batch Processing** - Efficient bulk import operations
- ✅ **Type-Safe** - Full TypeScript with runtime validation

## Features

### Core Capabilities

- **File Parsing**: CSV and Excel file parsing
- **Field Mapping**: Map source fields to Canvas transaction fields
- **Date Parsing**: Support for multiple date formats and timezones
- **Amount Parsing**: Handle various currency formats and separators
- **Validation**: Comprehensive validation with detailed error messages
- **Transformation**: Normalize and transform transaction data
- **Duplicate Detection**: Identify and handle duplicate transactions
- **Batch Processing**: Process large files efficiently

### Supported Formats

- **CSV**: Comma-separated values
- **Excel**: .xlsx and .xls files
- **Date Formats**: Multiple date format patterns
- **Currency Formats**: Various currency and amount formats

## Installation

Already installed as part of the Canvas monorepo workspace:

```json
{
  "dependencies": {
    "@oppulence/import": "workspace:*"
  }
}
```

## Quick Start

### Basic Import

```typescript
import {
  TransactionMapper,
  TransactionTransformer,
  TransactionValidator,
  DateParser,
  AmountParser,
} from '@oppulence/import';

// Parse CSV file
const csvData = await parseCsvFile(file);

// Map fields
const mapper = new TransactionMapper({
  mappings: {
    date: 'Transaction Date',
    amount: 'Amount',
    description: 'Description',
    category: 'Category',
  },
});

const mapped = mapper.mapTransactions(csvData);

// Transform transactions
const transformer = new TransactionTransformer({
  dateParser: new DateParser(),
  amountParser: new AmountParser(),
});

const transformed = transformer.transform(mapped);

// Validate transactions
const validator = new TransactionValidator();
const result = validator.validate(transformed);

if (result.valid) {
  // Import transactions
  await importTransactions(result.transactions);
} else {
  // Handle validation errors
  console.error(result.errors);
}
```

## API Reference

### Transaction Mapper

Maps source fields to Canvas transaction fields.

```typescript
import { TransactionMapper } from '@oppulence/import';

const mapper = new TransactionMapper({
  mappings: {
    date: 'Transaction Date',
    amount: 'Amount',
    description: 'Description',
    category: 'Category',
    account: 'Account Name',
  },
});

const mapped = mapper.mapTransactions(rawData);
```

### Transaction Transformer

Transforms and normalizes transaction data.

```typescript
import { TransactionTransformer, DateParser, AmountParser } from '@oppulence/import';

const transformer = new TransactionTransformer({
  dateParser: new DateParser({
    formats: ['MM/dd/yyyy', 'yyyy-MM-dd', 'dd/MM/yyyy'],
    timezone: 'America/New_York',
  }),
  amountParser: new AmountParser({
    currency: 'USD',
    decimalSeparator: '.',
    thousandSeparator: ',',
  }),
});

const transformed = transformer.transform(mappedTransactions);
```

### Transaction Validator

Validates transaction data.

```typescript
import { TransactionValidator } from '@oppulence/import';

const validator = new TransactionValidator({
  requiredFields: ['date', 'amount', 'description'],
  validateAmount: true,
  validateDate: true,
});

const result = validator.validate(transactions);
// { valid: boolean, transactions: Transaction[], errors: ValidationError[] }
```

### Date Parser

Parses dates from various formats.

```typescript
import { DateParser, formatDate } from '@oppulence/import';

const parser = new DateParser({
  formats: ['MM/dd/yyyy', 'yyyy-MM-dd'],
  timezone: 'America/New_York',
});

const date = parser.parse('12/31/2023');
// Returns: Date object

// Format date
const formatted = formatDate(date, 'yyyy-MM-dd');
```

### Amount Parser

Parses amounts and currency values.

```typescript
import { AmountParser, formatAmountValue, formatCurrency } from '@oppulence/import';

const parser = new AmountParser({
  currency: 'USD',
  decimalSeparator: '.',
  thousandSeparator: ',',
});

const amount = parser.parse('$1,234.56');
// Returns: 1234.56

// Format amount
const formatted = formatAmountValue(1234.56, 'USD');
// Returns: '$1,234.56'
```

### Duplicate Detector

Detects duplicate transactions.

```typescript
import { DuplicateDetector } from '@oppulence/import';

const detector = new DuplicateDetector({
  matchFields: ['date', 'amount', 'description'],
  tolerance: {
    amount: 0.01, // 1 cent tolerance
    date: 86400000, // 1 day tolerance
  },
});

const duplicates = detector.findDuplicates(transactions, existingTransactions);
```

## Usage Examples

### CSV Import

```typescript
import {
  parseCsvFile,
  TransactionMapper,
  TransactionTransformer,
  TransactionValidator,
} from '@oppulence/import';

// Parse CSV
const csvData = await parseCsvFile(file);

// Map fields
const mapper = new TransactionMapper({
  mappings: {
    date: 'Date',
    amount: 'Amount',
    description: 'Description',
  },
});

const mapped = mapper.mapTransactions(csvData);

// Transform
const transformer = new TransactionTransformer();
const transformed = transformer.transform(mapped);

// Validate
const validator = new TransactionValidator();
const result = validator.validate(transformed);

if (result.valid) {
  await importTransactions(result.transactions);
}
```

### Excel Import

```typescript
import { parseExcelFile } from '@oppulence/import';

const excelData = await parseExcelFile(file, {
  sheetName: 'Transactions',
  headerRow: 1,
});

// Process same as CSV
```

### Custom Field Mapping

```typescript
import { TransactionMapper, validateMappings } from '@oppulence/import';

const mappings = {
  date: 'Transaction Date',
  amount: 'Amount (USD)',
  description: 'Memo',
  category: 'Category',
  account: 'Account Name',
};

// Validate mappings before use
const validation = validateMappings(mappings, csvHeaders);
if (!validation.valid) {
  throw new Error(`Invalid mappings: ${validation.errors.join(', ')}`);
}

const mapper = new TransactionMapper({ mappings });
```

### Date Format Detection

```typescript
import { DateParser, getSupportedDateFormats } from '@oppulence/import';

// Get supported formats
const formats = getSupportedDateFormats();
// ['MM/dd/yyyy', 'dd/MM/yyyy', 'yyyy-MM-dd', ...]

// Auto-detect format
const parser = new DateParser({
  formats: formats,
  autoDetect: true,
});

const date = parser.parse('12/31/2023');
```

### Amount Formatting

```typescript
import { AmountParser, formatCurrency } from '@oppulence/import';

const parser = new AmountParser({
  currency: 'USD',
  decimalSeparator: '.',
  thousandSeparator: ',',
});

// Parse various formats
parser.parse('$1,234.56'); // 1234.56
parser.parse('1234.56'); // 1234.56
parser.parse('-500.00'); // -500.00

// Format for display
formatCurrency(1234.56, 'USD'); // '$1,234.56'
```

## Field Mapping

### Required Fields

- `date`: Transaction date
- `amount`: Transaction amount
- `description`: Transaction description

### Optional Fields

- `category`: Transaction category
- `account`: Account name/number
- `reference`: Reference number
- `notes`: Additional notes
- `tags`: Transaction tags

### Mapping Configuration

```typescript
interface FieldMapping {
  date: string; // Source field name
  amount: string;
  description: string;
  category?: string;
  account?: string;
  reference?: string;
  notes?: string;
  tags?: string;
}
```

## Validation

### Validation Rules

- **Required Fields**: Date, amount, description must be present
- **Date Format**: Must match supported date formats
- **Amount Format**: Must be valid numeric value
- **Currency**: Must be valid currency code
- **Length Limits**: Description, notes within character limits

### Validation Errors

```typescript
interface ValidationError {
  field: string;
  message: string;
  value: unknown;
  code: string;
}
```

### Custom Validation

```typescript
import { TransactionValidator, createTransactionSchema } from '@oppulence/import';

// Create custom schema
const schema = createTransactionSchema({
  requiredFields: ['date', 'amount', 'description'],
  validateAmount: true,
  validateDate: true,
  customRules: {
    amount: (value) => Math.abs(value) <= 1000000, // Max $1M
    description: (value) => value.length >= 3, // Min 3 chars
  },
});

const validator = new TransactionValidator({ schema });
```

## Error Handling

### Error Types

```typescript
import {
  ImportError,
  ValidationError,
  ParseError,
  TransformationError,
  MappingError,
  FileProcessingError,
  DuplicateError,
  BatchProcessingError,
} from '@oppulence/import';
```

### Error Utilities

```typescript
import { isRetryableError, wrapError, aggregateErrors } from '@oppulence/import';

// Check if retryable
if (isRetryableError(error)) {
  // Retry logic
}

// Wrap error with context
const wrapped = wrapError(error, { file: 'transactions.csv' });

// Aggregate multiple errors
const aggregated = aggregateErrors([error1, error2, error3]);
```

## Related Packages

- `@canvas/db` - Database operations for importing transactions
- `@canvas/jobs` - Background jobs for import processing

## License

Private - Oppulence Engineering

---

**Built with ❤️ by Oppulence Engineering**

*Comprehensive transaction import and processing for the Canvas platform.*
