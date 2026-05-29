-- CreateTable
CREATE TABLE `users` (
    `id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `username` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(191) NULL,
    `password_hash` VARCHAR(191) NOT NULL,
    `full_name` VARCHAR(191) NULL,
    `role` ENUM('USER', 'ADMIN', 'RESELLER') NOT NULL DEFAULT 'USER',
    `status` ENUM('ACTIVE', 'SUSPENDED', 'BANNED') NOT NULL DEFAULT 'ACTIVE',
    `email_verified` DATETIME(3) NULL,
    `last_login_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `users_email_key`(`email`),
    UNIQUE INDEX `users_username_key`(`username`),
    UNIQUE INDEX `users_phone_key`(`phone`),
    INDEX `users_role_status_idx`(`role`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sessions` (
    `id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `token` VARCHAR(128) NOT NULL,
    `user_agent` VARCHAR(512) NULL,
    `ip_address` VARCHAR(64) NULL,
    `expires_at` DATETIME(3) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `sessions_token_key`(`token`),
    INDEX `sessions_user_id_idx`(`user_id`),
    INDEX `sessions_expires_at_idx`(`expires_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `balances` (
    `id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `amount` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `version` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `balances_user_id_key`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `balance_mutations` (
    `id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `type` ENUM('TOPUP', 'PURCHASE', 'REFUND', 'ADJUSTMENT', 'COMMISSION') NOT NULL,
    `amount` DECIMAL(18, 2) NOT NULL,
    `balance_before` DECIMAL(18, 2) NOT NULL,
    `balance_after` DECIMAL(18, 2) NOT NULL,
    `description` VARCHAR(255) NULL,
    `reference_id` VARCHAR(191) NULL,
    `reference_type` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `balance_mutations_user_id_created_at_idx`(`user_id`, `created_at`),
    INDEX `balance_mutations_reference_id_idx`(`reference_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `products` (
    `id` VARCHAR(191) NOT NULL,
    `sku` VARCHAR(64) NOT NULL,
    `name` VARCHAR(160) NOT NULL,
    `brand` VARCHAR(64) NOT NULL,
    `category` ENUM('PULSA', 'DATA', 'PLN', 'GAME', 'EWALLET', 'VOUCHER', 'PASCABAYAR', 'STREAMING', 'OTHER') NOT NULL,
    `type` VARCHAR(64) NOT NULL,
    `description` TEXT NULL,
    `base_price` DECIMAL(18, 2) NOT NULL,
    `sell_price` DECIMAL(18, 2) NOT NULL,
    `reseller_price` DECIMAL(18, 2) NULL,
    `status` ENUM('ACTIVE', 'INACTIVE', 'GANGGUAN') NOT NULL DEFAULT 'ACTIVE',
    `is_cutoff` BOOLEAN NOT NULL DEFAULT false,
    `cutoff_start` VARCHAR(8) NULL,
    `cutoff_end` VARCHAR(8) NULL,
    `multi` BOOLEAN NOT NULL DEFAULT false,
    `stock` INTEGER NULL,
    `provider_meta` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `products_sku_key`(`sku`),
    INDEX `products_category_status_idx`(`category`, `status`),
    INDEX `products_brand_idx`(`brand`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `transactions` (
    `id` VARCHAR(191) NOT NULL,
    `order_id` VARCHAR(48) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `product_id` VARCHAR(191) NOT NULL,
    `product_sku` VARCHAR(64) NOT NULL,
    `product_name` VARCHAR(160) NOT NULL,
    `base_price` DECIMAL(18, 2) NOT NULL,
    `sell_price` DECIMAL(18, 2) NOT NULL,
    `admin_fee` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `total_amount` DECIMAL(18, 2) NOT NULL,
    `customer_no` VARCHAR(64) NOT NULL,
    `customer_name` VARCHAR(120) NULL,
    `server_id` VARCHAR(64) NULL,
    `payment_method` ENUM('BALANCE', 'DUITKU_VA', 'DUITKU_QRIS', 'DUITKU_EWALLET', 'DUITKU_RETAIL', 'DUITKU_OTHER') NOT NULL,
    `payment_channel` VARCHAR(32) NULL,
    `payment_ref` VARCHAR(80) NULL,
    `payment_url` TEXT NULL,
    `paid_at` DATETIME(3) NULL,
    `expired_at` DATETIME(3) NULL,
    `provider_ref` VARCHAR(80) NULL,
    `provider_sn` VARCHAR(160) NULL,
    `provider_message` VARCHAR(255) NULL,
    `status` ENUM('PENDING', 'PAID', 'PROCESSING', 'SUCCESS', 'FAILED', 'REFUNDED', 'EXPIRED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `transactions_order_id_key`(`order_id`),
    INDEX `transactions_user_id_created_at_idx`(`user_id`, `created_at`),
    INDEX `transactions_status_idx`(`status`),
    INDEX `transactions_payment_ref_idx`(`payment_ref`),
    INDEX `transactions_provider_ref_idx`(`provider_ref`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payment_gateway_logs` (
    `id` VARCHAR(191) NOT NULL,
    `transaction_id` VARCHAR(191) NULL,
    `provider` ENUM('DIGIFLAZZ', 'DUITKU') NOT NULL,
    `direction` ENUM('REQUEST', 'RESPONSE', 'WEBHOOK') NOT NULL,
    `endpoint` VARCHAR(255) NOT NULL,
    `http_status` INTEGER NULL,
    `signature` VARCHAR(160) NULL,
    `payload` JSON NULL,
    `error_message` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `payment_gateway_logs_transaction_id_idx`(`transaction_id`),
    INDEX `payment_gateway_logs_provider_direction_created_at_idx`(`provider`, `direction`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `sessions` ADD CONSTRAINT `sessions_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `balances` ADD CONSTRAINT `balances_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `balance_mutations` ADD CONSTRAINT `balance_mutations_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `transactions` ADD CONSTRAINT `transactions_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `transactions` ADD CONSTRAINT `transactions_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payment_gateway_logs` ADD CONSTRAINT `payment_gateway_logs_transaction_id_fkey` FOREIGN KEY (`transaction_id`) REFERENCES `transactions`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
