import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import path from 'path';
import fs from 'fs-extra';
import { randomBytes } from 'crypto';

@Injectable()
export class UtilsService {
  constructor(private configService: ConfigService) {}

  private publicDirPath = this.configService.getOrThrow<string>(
    'PUBLIC_DIR_ABSOLUTE_PATH',
  );

  private URLToPublicDir = '/public';

  // Allowed file types for image upload
  private readonly ALLOWED_IMAGE_TYPES = ['jpeg', 'jpg', 'png', 'gif', 'webp'];

  // Maximum file size: 5MB
  private readonly MAX_FILE_SIZE = 5 * 1024 * 1024;

  /**
   * Write image file to the public path from base64
   * @param base64Image base64 file data
   * @returns the written file path with the randomly generated file name
   */
  async writeBase64ImageToFile(base64Image: string): Promise<string> {
    // Validate base64 format
    if (!base64Image || typeof base64Image !== 'string') {
      throw new BadRequestException('Invalid base64 image data');
    }

    // Extract file extension with better validation
    const match = /^data:image\/([a-zA-Z0-9+]+);base64,/.exec(base64Image);
    if (!match) {
      throw new BadRequestException('Invalid image format. Must be a base64 encoded image.');
    }

    const fileExt = match[1].toLowerCase();

    // Validate file type
    if (!this.ALLOWED_IMAGE_TYPES.includes(fileExt)) {
      throw new BadRequestException(
        `Invalid file type: ${fileExt}. Allowed types: ${this.ALLOWED_IMAGE_TYPES.join(', ')}`
      );
    }

    // Remove data URL prefix and get base64 data
    const base64Data = base64Image.replace(/^data:image\/[a-zA-Z0-9+]+;base64,/, '');

    // Convert to buffer and validate size
    const dataBuffer = Buffer.from(base64Data, 'base64');
    if (dataBuffer.length > this.MAX_FILE_SIZE) {
      throw new BadRequestException(
        `File size exceeds maximum allowed size of ${this.MAX_FILE_SIZE / 1024 / 1024}MB`
      );
    }

    if (dataBuffer.length === 0) {
      throw new BadRequestException('Empty file data');
    }

    // Generate secure random filename
    const fileName = `${randomBytes(16).toString('hex')}.${fileExt}`;
    const filePath = path.join(this.publicDirPath, fileName);

    // Ensure directory exists
    await fs.ensureDir(this.publicDirPath);

    // Write file
    await fs.writeFile(filePath, dataBuffer);

    return filePath;
  }

  filePathToURL(filePath: string): string {
    return filePath.replace(this.publicDirPath, this.URLToPublicDir);
  }
}
