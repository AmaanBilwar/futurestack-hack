import { NextRequest, NextResponse } from 'next/server';
import { generateUnitTests } from '../code-reviewer';

export async function POST(request: NextRequest) {
  try {
    const { code, analysis, fileName } = await request.json();

    if (!code) {
      return NextResponse.json(
        { error: 'Code is required' },
        { status: 400 }
      );
    }

    if (!analysis) {
      return NextResponse.json(
        { error: 'Analysis is required to generate unit tests' },
        { status: 400 }
      );
    }

    const unitTests = await generateUnitTests(code, analysis, fileName);

    return NextResponse.json({
      success: true,
      unitTests,
      fileName: fileName || 'Unknown file'
    });

  } catch (error) {
    console.error('Unit test generation API error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to generate unit tests',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
