import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateVideos1789847748569 implements MigrationInterface {
  name = 'CreateVideos1789847748569';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "videos" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "slug" uuid NOT NULL, "channel_id" uuid NOT NULL, "title" character varying(200) NOT NULL, "status" character varying(16) NOT NULL DEFAULT 'draft', "size_bytes" bigint NOT NULL, "content_type" character varying(100) NOT NULL, "object_key" text NOT NULL, "thumbnail_key" text, "upload_id" text, "duration_seconds" double precision, "metadata" jsonb, "error_code" text, "enqueue_pending" boolean NOT NULL DEFAULT false, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_5dbcc1ee100f853490582eccc71" UNIQUE ("slug"), CONSTRAINT "PK_e4c86c0cf95aff16e9fb8220f6b" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_b713984552ac08a0b58ae59f58" ON "videos" ("status", "enqueue_pending") `,
    );
    await queryRunner.query(
      `ALTER TABLE "videos" ADD CONSTRAINT "FK_023a8e4f3f1a34ff3d8ca04a4cc" FOREIGN KEY ("channel_id") REFERENCES "channels"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "videos" DROP CONSTRAINT "FK_023a8e4f3f1a34ff3d8ca04a4cc"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_b713984552ac08a0b58ae59f58"`,
    );
    await queryRunner.query(`DROP TABLE "videos"`);
  }
}
