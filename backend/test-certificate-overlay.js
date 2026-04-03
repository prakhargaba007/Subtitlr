const { generateCertificate, getCertificatePath } = require('./utils/certificateGenerator');

async function testCertificateOverlay() {
  try {
    console.log('Testing certificate overlay generation...');
    
    const testData = {
      studentName: 'John Doe',
      courseName: 'Advanced Poker Strategies',
      instructorName: 'Amrit',
      completionDate: 'January 15, 2024',
      certificateId: 'CERT-OVERLAY-TEST-1234567890-abc123'
    };
    
    const certificatePath = getCertificatePath(testData.certificateId);
    console.log('Certificate will be saved to:', certificatePath);
    
    await generateCertificate({
      ...testData,
      outputPath: certificatePath
    });
    
    console.log('✅ Certificate with overlay generated successfully!');
    console.log('📁 File saved at:', certificatePath);
    
  } catch (error) {
    console.error('❌ Error generating certificate with overlay:', error);
  }
}

// Run the test
testCertificateOverlay();
