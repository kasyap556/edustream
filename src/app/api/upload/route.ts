import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { auth } from '@/lib/auth';

export async function POST(req: NextRequest) {
    // Only authenticated users may upload files
    const session = await auth();
    if (!session?.user?.email) {
        return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    try {
        const formData = await req.formData();
        const file = formData.get('file') as File | null;

        if (!file) {
            return NextResponse.json({ message: 'No file provided' }, { status: 400 });
        }

        // Validate file type
        const allowedTypes = [
            'application/pdf',
            'application/vnd.ms-powerpoint',
            'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/msword',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'text/plain',
            'application/zip',
            'image/jpeg',
            'image/png',
            'image/gif',
            'image/webp',
        ];
        if (!allowedTypes.includes(file.type)) {
            return NextResponse.json(
                { message: 'File type not allowed. Supported: PDF, PPT, Word, Excel, images, text, zip' },
                { status: 400 }
            );
        }

        // Validate file size (max 20MB)
        const MAX_SIZE = 20 * 1024 * 1024;
        if (file.size > MAX_SIZE) {
            return NextResponse.json(
                { message: 'File size must be under 20MB' },
                { status: 400 }
            );
        }

        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        // Save to public/uploads directory
        const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
        await mkdir(uploadsDir, { recursive: true });

        // Sanitize filename and make unique
        const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const uniqueName = `${Date.now()}_${sanitizedName}`;
        const filePath = path.join(uploadsDir, uniqueName);

        await writeFile(filePath, buffer);

        const fileUrl = `/uploads/${uniqueName}`;

        return NextResponse.json({
            url: fileUrl,
            name: file.name,
            type: file.type,
            size: file.size,
        });
    } catch (error) {
        console.error('Upload error:', error);
        return NextResponse.json(
            { message: 'Upload failed. Please try again.' },
            { status: 500 }
        );
    }
}
