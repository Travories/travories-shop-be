import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260909061654 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "payout_adjustment" drop constraint if exists "payout_adjustment_payout_id_type_source_id_unique";`);
    this.addSql(`create table if not exists "payout_adjustment" ("id" text not null, "amount" numeric not null, "type" text check ("type" in ('cancellation', 'refund')) not null, "source_id" text not null, "payout_id" text not null, "raw_amount" jsonb not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "payout_adjustment_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_payout_adjustment_payout_id" ON "payout_adjustment" ("payout_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_payout_adjustment_deleted_at" ON "payout_adjustment" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_payout_adjustment_payout_id_type_source_id_unique" ON "payout_adjustment" ("payout_id", "type", "source_id") WHERE deleted_at IS NULL;`);

    this.addSql(`alter table if exists "payout_adjustment" add constraint "payout_adjustment_payout_id_foreign" foreign key ("payout_id") references "payout" ("id") on update cascade;`);

    this.addSql(`alter table if exists "payout" drop constraint if exists "payout_status_check";`);

    this.addSql(`alter table if exists "payout" add column if not exists "reversed_amount" numeric not null default 0, add column if not exists "raw_reversed_amount" jsonb not null default '{"value":"0","precision":20}';`);
    this.addSql(`alter table if exists "payout" add constraint "payout_status_check" check("status" in ('pending', 'paid', 'partially_reversed', 'reversed'));`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "payout_adjustment" cascade;`);

    this.addSql(`alter table if exists "payout" drop constraint if exists "payout_status_check";`);

    this.addSql(`alter table if exists "payout" drop column if exists "reversed_amount", drop column if exists "raw_reversed_amount";`);

    this.addSql(`alter table if exists "payout" add constraint "payout_status_check" check("status" in ('pending', 'paid'));`);
  }

}
