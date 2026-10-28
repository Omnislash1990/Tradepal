CREATE TABLE `addresses` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`label` text,
	`name` text NOT NULL,
	`line1` text NOT NULL,
	`line2` text,
	`town` text NOT NULL,
	`county` text,
	`postcode` text NOT NULL,
	`phone` text,
	`instructions` text,
	`is_default` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `addresses_user_idx` ON `addresses` (`user_id`);--> statement-breakpoint
CREATE TABLE `ai_usage` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`visitor_id` text NOT NULL,
	`feature` text NOT NULL,
	`provider` text NOT NULL,
	`model` text,
	`intent` text,
	`input_tokens` integer DEFAULT 0 NOT NULL,
	`output_tokens` integer DEFAULT 0 NOT NULL,
	`cost_centipence` integer DEFAULT 0 NOT NULL,
	`latency_ms` integer DEFAULT 0 NOT NULL,
	`success` integer DEFAULT true NOT NULL,
	`estimate_gross` integer,
	`added_to_basket` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `ai_usage_created_idx` ON `ai_usage` (`created_at`);--> statement-breakpoint
CREATE INDEX `ai_usage_visitor_idx` ON `ai_usage` (`visitor_id`);--> statement-breakpoint
CREATE TABLE `audit_log` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_id` text,
	`actor_name` text,
	`action` text NOT NULL,
	`entity` text NOT NULL,
	`entity_id` text,
	`summary` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `audit_created_idx` ON `audit_log` (`created_at`);--> statement-breakpoint
CREATE TABLE `basket_items` (
	`id` text PRIMARY KEY NOT NULL,
	`basket_id` text NOT NULL,
	`product_id` text NOT NULL,
	`quantity` integer NOT NULL,
	`source` text DEFAULT 'manual' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`basket_id`) REFERENCES `baskets`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `basket_items_unique_idx` ON `basket_items` (`basket_id`,`product_id`);--> statement-breakpoint
CREATE TABLE `baskets` (
	`id` text PRIMARY KEY NOT NULL,
	`token` text NOT NULL,
	`user_id` text,
	`postcode` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `baskets_token_unique` ON `baskets` (`token`);--> statement-breakpoint
CREATE INDEX `baskets_user_idx` ON `baskets` (`user_id`);--> statement-breakpoint
CREATE TABLE `categories` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`icon` text DEFAULT 'Package' NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `categories_slug_unique` ON `categories` (`slug`);--> statement-breakpoint
CREATE TABLE `delivery_zones` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`postcode_prefixes` text NOT NULL,
	`rates` text NOT NULL,
	`extra_lead_days` integer DEFAULT 0 NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`notes` text,
	`sort_order` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `feed_imports` (
	`id` text PRIMARY KEY NOT NULL,
	`supplier_id` text NOT NULL,
	`source` text NOT NULL,
	`filename` text,
	`rows` integer DEFAULT 0 NOT NULL,
	`updated` integer DEFAULT 0 NOT NULL,
	`created` integer DEFAULT 0 NOT NULL,
	`errors` text NOT NULL,
	`created_by` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `list_items` (
	`id` text PRIMARY KEY NOT NULL,
	`list_id` text NOT NULL,
	`product_id` text NOT NULL,
	`quantity` integer DEFAULT 1 NOT NULL,
	`note` text,
	FOREIGN KEY (`list_id`) REFERENCES `lists`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `list_items_unique_idx` ON `list_items` (`list_id`,`product_id`);--> statement-breakpoint
CREATE TABLE `lists` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`kind` text DEFAULT 'saved' NOT NULL,
	`job_spec` text,
	`notes` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `lists_user_idx` ON `lists` (`user_id`);--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`channel` text DEFAULT 'email' NOT NULL,
	`to` text NOT NULL,
	`subject` text NOT NULL,
	`body` text NOT NULL,
	`template` text NOT NULL,
	`status` text DEFAULT 'queued' NOT NULL,
	`provider` text,
	`provider_id` text,
	`error` text,
	`order_id` text,
	`user_id` text,
	`created_at` integer NOT NULL,
	`sent_at` integer
);
--> statement-breakpoint
CREATE INDEX `notifications_created_idx` ON `notifications` (`created_at`);--> statement-breakpoint
CREATE TABLE `order_events` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`type` text NOT NULL,
	`message` text NOT NULL,
	`actor` text DEFAULT 'system' NOT NULL,
	`customer_visible` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `order_events_order_idx` ON `order_events` (`order_id`);--> statement-breakpoint
CREATE TABLE `order_lines` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`shipment_id` text,
	`product_id` text,
	`supplier_id` text,
	`sku` text NOT NULL,
	`name` text NOT NULL,
	`quantity` integer NOT NULL,
	`unit_gross` integer NOT NULL,
	`regular_unit_gross` integer NOT NULL,
	`vat_bps` integer NOT NULL,
	`unit_cost_net` integer DEFAULT 0 NOT NULL,
	`price_kind` text DEFAULT 'regular' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`substituted_from` text,
	`refunded_qty` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`shipment_id`) REFERENCES `shipments`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `order_lines_order_idx` ON `order_lines` (`order_id`);--> statement-breakpoint
CREATE INDEX `order_lines_product_idx` ON `order_lines` (`product_id`);--> statement-breakpoint
CREATE TABLE `orders` (
	`id` text PRIMARY KEY NOT NULL,
	`number` text NOT NULL,
	`user_id` text,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`phone` text,
	`company_name` text,
	`po_reference` text,
	`is_trade` integer DEFAULT false NOT NULL,
	`status` text DEFAULT 'pending_payment' NOT NULL,
	`payment_status` text DEFAULT 'unpaid' NOT NULL,
	`delivery_address` text NOT NULL,
	`zone_id` text,
	`goods_gross` integer NOT NULL,
	`delivery_gross` integer NOT NULL,
	`total_gross` integer NOT NULL,
	`vat_total` integer NOT NULL,
	`savings_gross` integer DEFAULT 0 NOT NULL,
	`est_supplier_cost_net` integer DEFAULT 0 NOT NULL,
	`est_supplier_delivery_net` integer DEFAULT 0 NOT NULL,
	`est_payment_fee` integer DEFAULT 0 NOT NULL,
	`actual_payment_fee` integer,
	`refunded_gross` integer DEFAULT 0 NOT NULL,
	`payment_provider` text DEFAULT 'demo' NOT NULL,
	`stripe_session_id` text,
	`stripe_payment_intent_id` text,
	`paid_at` integer,
	`source` text DEFAULT 'web' NOT NULL,
	`tracking_token` text NOT NULL,
	`customer_notes` text,
	`internal_notes` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `orders_number_unique` ON `orders` (`number`);--> statement-breakpoint
CREATE INDEX `orders_user_idx` ON `orders` (`user_id`);--> statement-breakpoint
CREATE INDEX `orders_status_idx` ON `orders` (`status`);--> statement-breakpoint
CREATE INDEX `orders_created_idx` ON `orders` (`created_at`);--> statement-breakpoint
CREATE TABLE `payment_events` (
	`id` text PRIMARY KEY NOT NULL,
	`provider_event_id` text,
	`order_id` text,
	`provider` text NOT NULL,
	`type` text NOT NULL,
	`amount_gross` integer,
	`fee` integer,
	`reference` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `payment_events_provider_event_id_unique` ON `payment_events` (`provider_event_id`);--> statement-breakpoint
CREATE INDEX `payment_events_order_idx` ON `payment_events` (`order_id`);--> statement-breakpoint
CREATE TABLE `pricing_rules` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`scope` text NOT NULL,
	`scope_id` text,
	`markup_bps` integer NOT NULL,
	`min_margin_bps` integer DEFAULT 0 NOT NULL,
	`rounding` text DEFAULT 'end9' NOT NULL,
	`priority` integer DEFAULT 0 NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `products` (
	`id` text PRIMARY KEY NOT NULL,
	`sku` text NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`category_id` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`unit` text DEFAULT 'each' NOT NULL,
	`image_key` text DEFAULT 'board' NOT NULL,
	`image_url` text,
	`tags` text NOT NULL,
	`attributes` text NOT NULL,
	`specs` text NOT NULL,
	`compatible_skus` text NOT NULL,
	`family` text,
	`alt_note` text,
	`safety_note` text,
	`vat_bps` integer DEFAULT 2000 NOT NULL,
	`delivery_class` text DEFAULT 'standard' NOT NULL,
	`weight_kg` real,
	`retail_price_gross` integer DEFAULT 0 NOT NULL,
	`price_override_gross` integer,
	`ref_cost_net` integer,
	`margin_bps` integer,
	`pricing_rule_id` text,
	`price_updated_at` integer,
	`promo_bps` integer,
	`promo_ends_at` integer,
	`active` integer DEFAULT true NOT NULL,
	`popularity` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `products_sku_unique` ON `products` (`sku`);--> statement-breakpoint
CREATE UNIQUE INDEX `products_slug_unique` ON `products` (`slug`);--> statement-breakpoint
CREATE INDEX `products_category_idx` ON `products` (`category_id`);--> statement-breakpoint
CREATE INDEX `products_family_idx` ON `products` (`family`);--> statement-breakpoint
CREATE TABLE `purchase_orders` (
	`id` text PRIMARY KEY NOT NULL,
	`number` text NOT NULL,
	`order_id` text NOT NULL,
	`shipment_id` text NOT NULL,
	`supplier_id` text NOT NULL,
	`method` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`total_cost_net` integer NOT NULL,
	`delivery_cost_net` integer DEFAULT 0 NOT NULL,
	`supplier_ref` text,
	`payload` text,
	`error` text,
	`sent_at` integer,
	`acknowledged_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`shipment_id`) REFERENCES `shipments`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `purchase_orders_number_unique` ON `purchase_orders` (`number`);--> statement-breakpoint
CREATE INDEX `po_order_idx` ON `purchase_orders` (`order_id`);--> statement-breakpoint
CREATE INDEX `po_supplier_idx` ON `purchase_orders` (`supplier_id`);--> statement-breakpoint
CREATE TABLE `quotes` (
	`id` text PRIMARY KEY NOT NULL,
	`number` text NOT NULL,
	`user_id` text NOT NULL,
	`reference` text,
	`lines` text NOT NULL,
	`goods_gross` integer NOT NULL,
	`delivery_gross` integer DEFAULT 0 NOT NULL,
	`postcode` text,
	`valid_until` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `quotes_number_unique` ON `quotes` (`number`);--> statement-breakpoint
CREATE INDEX `quotes_user_idx` ON `quotes` (`user_id`);--> statement-breakpoint
CREATE TABLE `rate_limits` (
	`key` text NOT NULL,
	`window_start` integer NOT NULL,
	`count` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`key`, `window_start`)
);
--> statement-breakpoint
CREATE TABLE `refunds` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`amount_gross` integer NOT NULL,
	`reason` text NOT NULL,
	`lines` text NOT NULL,
	`provider` text NOT NULL,
	`provider_ref` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_by` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `refunds_order_idx` ON `refunds` (`order_id`);--> statement-breakpoint
CREATE TABLE `return_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`user_id` text,
	`lines` text NOT NULL,
	`reason` text NOT NULL,
	`details` text,
	`status` text DEFAULT 'requested' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `returns_order_idx` ON `return_requests` (`order_id`);--> statement-breakpoint
CREATE TABLE `search_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`query` text NOT NULL,
	`results_count` integer NOT NULL,
	`source` text DEFAULT 'search' NOT NULL,
	`detected_job` text,
	`user_id` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `search_logs_created_idx` ON `search_logs` (`created_at`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	`user_agent` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `sessions_user_idx` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `shipments` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`supplier_id` text NOT NULL,
	`delivery_class` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`customer_charge_gross` integer DEFAULT 0 NOT NULL,
	`supplier_delivery_cost_net` integer DEFAULT 0 NOT NULL,
	`estimated_date` text NOT NULL,
	`carrier` text,
	`tracking_ref` text,
	`dispatched_at` integer,
	`delivered_at` integer,
	`notes` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `shipments_order_idx` ON `shipments` (`order_id`);--> statement-breakpoint
CREATE INDEX `shipments_supplier_idx` ON `shipments` (`supplier_id`);--> statement-breakpoint
CREATE TABLE `supplier_invoices` (
	`id` text PRIMARY KEY NOT NULL,
	`supplier_id` text NOT NULL,
	`order_id` text,
	`purchase_order_id` text,
	`invoice_number` text NOT NULL,
	`invoice_date` text NOT NULL,
	`goods_net` integer NOT NULL,
	`delivery_net` integer DEFAULT 0 NOT NULL,
	`vat` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'received' NOT NULL,
	`notes` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`purchase_order_id`) REFERENCES `purchase_orders`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `sinv_order_idx` ON `supplier_invoices` (`order_id`);--> statement-breakpoint
CREATE TABLE `supplier_offers` (
	`id` text PRIMARY KEY NOT NULL,
	`supplier_id` text NOT NULL,
	`product_id` text NOT NULL,
	`supplier_sku` text NOT NULL,
	`cost_net` integer NOT NULL,
	`stock_status` text DEFAULT 'unknown' NOT NULL,
	`stock_qty` integer,
	`lead_time_days` integer,
	`verified` integer DEFAULT false NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`last_synced_at` integer,
	FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `offers_supplier_product_idx` ON `supplier_offers` (`supplier_id`,`product_id`);--> statement-breakpoint
CREATE INDEX `offers_product_idx` ON `supplier_offers` (`product_id`);--> statement-breakpoint
CREATE TABLE `suppliers` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`contact_name` text,
	`email` text,
	`phone` text,
	`integration` text DEFAULT 'email' NOT NULL,
	`serves_areas` text NOT NULL,
	`lead_time_days` integer DEFAULT 2 NOT NULL,
	`cutoff_hour` integer DEFAULT 13 NOT NULL,
	`delivers_saturday` integer DEFAULT false NOT NULL,
	`delivery_costs` text NOT NULL,
	`account_number` text,
	`payment_terms` text,
	`is_sample` integer DEFAULT false NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`notes` text,
	`last_feed_at` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `suppliers_code_unique` ON `suppliers` (`code`);--> statement-breakpoint
CREATE TABLE `support_tickets` (
	`id` text PRIMARY KEY NOT NULL,
	`number` text NOT NULL,
	`user_id` text,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`order_id` text,
	`subject` text NOT NULL,
	`topic` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`priority` text DEFAULT 'normal' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `support_tickets_number_unique` ON `support_tickets` (`number`);--> statement-breakpoint
CREATE INDEX `tickets_user_idx` ON `support_tickets` (`user_id`);--> statement-breakpoint
CREATE INDEX `tickets_status_idx` ON `support_tickets` (`status`);--> statement-breakpoint
CREATE TABLE `ticket_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`ticket_id` text NOT NULL,
	`author` text NOT NULL,
	`author_name` text NOT NULL,
	`body` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`ticket_id`) REFERENCES `support_tickets`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `ticket_messages_ticket_idx` ON `ticket_messages` (`ticket_id`);--> statement-breakpoint
CREATE TABLE `trade_accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`company_name` text NOT NULL,
	`company_number` text,
	`vat_number` text,
	`trade_type` text NOT NULL,
	`phone` text,
	`monthly_spend` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`discount_bps` integer DEFAULT 0 NOT NULL,
	`notes` text,
	`reviewed_by` text,
	`reviewed_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `trade_accounts_user_id_unique` ON `trade_accounts` (`user_id`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`name` text NOT NULL,
	`phone` text,
	`role` text DEFAULT 'customer' NOT NULL,
	`account_type` text DEFAULT 'diy' NOT NULL,
	`trade_status` text DEFAULT 'none' NOT NULL,
	`trade_discount_bps` integer DEFAULT 0 NOT NULL,
	`marketing_opt_in` integer DEFAULT false NOT NULL,
	`prices_ex_vat` integer DEFAULT false NOT NULL,
	`last_login_at` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE TABLE `waitlist` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`postcode` text NOT NULL,
	`area` text NOT NULL,
	`created_at` integer NOT NULL
);
