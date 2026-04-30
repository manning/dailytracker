import {
  pgTable,
  pgEnum,
  text,
  timestamp,
  boolean,
  integer,
  doublePrecision,
  uuid,
  index,
} from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'

export const metricTypeEnum = pgEnum('metric_type', [
  'NUMBER', 'SCALE', 'BOOLEAN', 'DURATION', 'CATEGORICAL', 'TEXT',
])

export const entrySourceEnum = pgEnum('entry_source', ['MANUAL', 'CONNECTOR'])

export const users = pgTable('users', {
  id:           uuid('id').primaryKey().defaultRandom(),
  email:        text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  name:         text('name'),
  createdAt:    timestamp('created_at').defaultNow().notNull(),
  updatedAt:    timestamp('updated_at').defaultNow().notNull().$onUpdateFn(() => new Date()),
})

// Note on DURATION metrics: numeric_value is stored in **seconds**. The metric's
// `unit` field ("hours" | "minutes" | "seconds") drives display formatting and
// disambiguates plain-number input (e.g. "5.2" with unit=hours → 18720 seconds).
export const metricDefinitions = pgTable('metric_definitions', {
  id:                  uuid('id').primaryKey().defaultRandom(),
  userId:              uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name:                text('name').notNull(),
  type:                metricTypeEnum('type').notNull(),
  unit:                text('unit'),
  color:               text('color'),
  order:               integer('order').notNull().default(0),
  allowMultiplePerDay: boolean('allow_multiple_per_day').notNull().default(false),
  // For SCALE metrics only; null means "use app default of 1–10".
  scaleMin:            integer('scale_min'),
  scaleMax:            integer('scale_max'),
  // Pre-fill values for the daily check-in. Semantics by type:
  //   number/scale/duration -> defaultNumericValue
  //   categorical/text      -> defaultTextValue
  //   boolean (tag)         -> defaultNumericValue = 1 means "default-on" (chip pre-selected)
  defaultNumericValue: doublePrecision('default_numeric_value'),
  defaultTextValue:    text('default_text_value'),
  connectorId:         text('connector_id'),
  archivedAt:          timestamp('archived_at'),
  createdAt:           timestamp('created_at').defaultNow().notNull(),
  updatedAt:           timestamp('updated_at').defaultNow().notNull().$onUpdateFn(() => new Date()),
}, (t) => ({
  userIdIdx: index('metric_definitions_user_id_idx').on(t.userId),
}))

export const metricEntries = pgTable('metric_entries', {
  id:           uuid('id').primaryKey().defaultRandom(),
  userId:       uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  metricDefId:  uuid('metric_def_id').notNull().references(() => metricDefinitions.id, { onDelete: 'cascade' }),
  numericValue: doublePrecision('numeric_value'),
  textValue:    text('text_value'),
  loggedAt:     timestamp('logged_at').notNull(),
  source:       entrySourceEnum('source').notNull().default('MANUAL'),
  connectorRef: text('connector_ref'),
  createdAt:    timestamp('created_at').defaultNow().notNull(),
  updatedAt:    timestamp('updated_at').defaultNow().notNull().$onUpdateFn(() => new Date()),
}, (t) => ({
  userIdIdx:      index('metric_entries_user_id_idx').on(t.userId),
  metricDefIdIdx: index('metric_entries_metric_def_id_idx').on(t.metricDefId),
  loggedAtIdx:    index('metric_entries_logged_at_idx').on(t.loggedAt),
}))

// Relations for use with db.query.*
export const usersRelations = relations(users, ({ many }) => ({
  metricDefs: many(metricDefinitions),
  entries:    many(metricEntries),
}))

export const metricDefinitionsRelations = relations(metricDefinitions, ({ one, many }) => ({
  user:    one(users, { fields: [metricDefinitions.userId], references: [users.id] }),
  entries: many(metricEntries),
}))

export const metricEntriesRelations = relations(metricEntries, ({ one }) => ({
  user:      one(users,             { fields: [metricEntries.userId],      references: [users.id] }),
  metricDef: one(metricDefinitions, { fields: [metricEntries.metricDefId], references: [metricDefinitions.id] }),
}))
