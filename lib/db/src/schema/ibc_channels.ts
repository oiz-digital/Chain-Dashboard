import { pgTable, serial, varchar, text, integer, boolean, timestamp, pgEnum } from "drizzle-orm/pg-core";

export const channelStatusEnum = pgEnum("channel_status", ["open", "closed", "init", "tryopen"]);

export const ibcChannelsTable = pgTable("ibc_channels", {
  id:            serial("id").primaryKey(),
  channelId:     varchar("channel_id", { length: 32 }).notNull().unique(),
  portId:        varchar("port_id", { length: 64 }).notNull(),
  counterpartyChain:    varchar("counterparty_chain", { length: 64 }).notNull(),
  counterpartyChannelId:varchar("counterparty_channel_id", { length: 32 }).notNull(),
  counterpartyPortId:   varchar("counterparty_port_id", { length: 64 }).notNull(),
  status:        channelStatusEnum("status").notNull().default("open"),
  ordering:      varchar("ordering", { length: 16 }).notNull().default("unordered"),
  version:       varchar("version", { length: 32 }).notNull().default("ics20-1"),
  packetsSent:   integer("packets_sent").notNull().default(0),
  packetsReceived:integer("packets_received").notNull().default(0),
  totalValueUsd: varchar("total_value_usd", { length: 32 }).notNull().default("0"),
  createdAt:     timestamp("created_at").notNull().defaultNow(),
});
