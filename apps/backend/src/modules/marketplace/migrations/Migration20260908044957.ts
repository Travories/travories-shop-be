import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260908044957 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "seller" drop constraint if exists "seller_handle_unique";`);
    this.addSql(`create table if not exists "seller" ("id" text not null, "name" text not null, "handle" text not null, "description" text null, "photo" text null, "status" text check ("status" in ('pending', 'active', 'suspended', 'rejected')) not null default 'pending', "commission_rate" real null, "email" text not null, "phone" text null, "payout_bank_name" text null, "payout_account_name" text null, "payout_account_number" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "seller_pkey" primary key ("id"));`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_seller_handle_unique" ON "seller" ("handle") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_seller_deleted_at" ON "seller" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "payout" ("id" text not null, "amount" numeric not null, "currency_code" text not null default 'npr', "status" text check ("status" in ('pending', 'paid')) not null default 'pending', "order_id" text not null, "reference" text null, "seller_id" text not null, "raw_amount" jsonb not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "payout_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_payout_seller_id" ON "payout" ("seller_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_payout_deleted_at" ON "payout" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "member" ("id" text not null, "name" text null, "email" text not null, "role" text check ("role" in ('owner', 'staff')) not null default 'owner', "seller_id" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "member_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_member_seller_id" ON "member" ("seller_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_member_deleted_at" ON "member" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`alter table if exists "payout" add constraint "payout_seller_id_foreign" foreign key ("seller_id") references "seller" ("id") on update cascade;`);

    this.addSql(`alter table if exists "member" add constraint "member_seller_id_foreign" foreign key ("seller_id") references "seller" ("id") on update cascade;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "payout" drop constraint if exists "payout_seller_id_foreign";`);

    this.addSql(`alter table if exists "member" drop constraint if exists "member_seller_id_foreign";`);

    this.addSql(`drop table if exists "seller" cascade;`);

    this.addSql(`drop table if exists "payout" cascade;`);

    this.addSql(`drop table if exists "member" cascade;`);
  }

}
