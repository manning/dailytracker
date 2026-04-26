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

export const metricDefinitions = pgTable('metric_definitions', {
  id:                 uuid('id').primaryKey().defaultRandom(),
  userId:             uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name:               text('name').notNull(),
  type:               metricTypeEnum('type').notNull(),
  unit:               text('unit'),
  color:              text('color'),
  order:              integer('order').notNull().default(0),
  allowMultiplePerDay: boolean('allow_multiple_per_day').notNull().default(false),
  connectorId:        text('connector_id'),
  archivedAt:         timestamp('archived_at'),
  createdAt:          timestamp('created_at').defaultNow().notNull(),
  updatedAt:          timestamp('updated_at').defaultNow().notNull().$onUpdateFn(() => new Date()),
}, (t) => [
  index('metric_definitions_user_id_idx').on(t.userId),
])

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
}, (t) => [
  index('metric_entries_user_id_idx').on(t.userId),
  index('metric_entries_metric_def_id_idx').on(t.metricDefId),
  index('metric_entries_logged_at_idx').on(t.loggedAt),
])

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
