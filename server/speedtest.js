import fetch from 'node-fetch';

export class SpeedTest {
    constructor() {
        // Using Cloudflare's speed test file
        this.downloadUrls = [
            'https://speed.cloudflare.com/__down?bytes=25000000', // 25MB file
            'https://speed.cloudflare.com/__down?bytes=10000000', // 10MB file
            'https://speed.cloudflare.com/__down?bytes=5000000'   // 5MB file
        ];
        // Using httpbin.org for upload testing
        this.uploadUrl = 'https://httpbin.org/post';
    }

    // Convert bytes to megabits
    bytesToMbps(bytes, timeInSeconds) {
        return ((bytes * 8) / (1024 * 1024) / timeInSeconds);
    }

    // Generate random data for upload testing
    generateTestData(sizeInMB) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        const bytes = sizeInMB * 1024 * 1024;
        let result = '';
        for (let i = 0; i < bytes; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }

    // Measure download speed
    async testDownloadSpeed() {
        try {
            console.log('Starting download test...');
            let totalSpeed = 0;
            let successfulTests = 0;

            for (const url of this.downloadUrls) {
                try {
                    const startTime = process.hrtime();
                    const response = await fetch(url);
                    const data = await response.buffer();
                    const [seconds, nanoseconds] = process.hrtime(startTime);
                    const durationInSeconds = seconds + nanoseconds / 1e9;
                    const speedMbps = this.bytesToMbps(data.length, durationInSeconds);
                    totalSpeed += parseFloat(speedMbps);
                    successfulTests++;
                    console.log(`Download speed (${successfulTests}): ${speedMbps.toFixed(2)} Mbps`);
                } catch (error) {
                    console.error(`Failed one download test: ${error.message}`);
                }
            }

            if (successfulTests === 0) {
                throw new Error('All download tests failed');
            }

            const averageSpeed = totalSpeed / successfulTests;
            return {
                speed: averageSpeed.toFixed(2),
                duration: successfulTests.toString()
            };
        } catch (error) {
            console.error('Download test failed:', error);
            return null;
        }
    }

    // Measure upload speed
    async testUploadSpeed() {
        try {
            console.log('Starting upload test...');
            const testData = this.generateTestData(2); // 2MB of data
            
            const startTime = process.hrtime();
            const response = await fetch(this.uploadUrl, {
                method: 'POST',
                body: testData,
                headers: {
                    'Content-Type': 'text/plain',
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const [seconds, nanoseconds] = process.hrtime(startTime);
            const durationInSeconds = seconds + nanoseconds / 1e9;
            
            const speedMbps = this.bytesToMbps(testData.length, durationInSeconds);
            return {
                speed: speedMbps.toFixed(2),
                duration: durationInSeconds.toFixed(2)
            };
        } catch (error) {
            console.error('Upload test failed:', error);
            return null;
        }
    }

    // Run complete speed test
    async runSpeedTest() {
        const downloadResult = await this.testDownloadSpeed();
        const uploadResult = await this.testUploadSpeed();

        return {
            download: downloadResult,
            upload: uploadResult,
            timestamp: new Date().toISOString()
        };
    }
}

// Example usage:
async function main() {
    const speedTest = new SpeedTest();
    console.log('Starting speed test...');
    
    const results = await speedTest.runSpeedTest();
    
    if (results.download || results.upload) {
        console.log('\nTest Results:');
        if (results.download) {
            console.log(`Average Download Speed: ${results.download.speed} Mbps (${results.download.duration} successful tests)`);
        }
        if (results.upload) {
            console.log(`Upload Speed: ${results.upload.speed} Mbps (${results.upload.duration}s)`);
        }
        console.log(`Tested at: ${new Date(results.timestamp).toLocaleString()}`);
    } else {
        console.log('All tests failed. Please check your internet connection and try again.');
    }
}

main().catch(console.error);