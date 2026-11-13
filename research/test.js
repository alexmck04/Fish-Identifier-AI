import { RekognitionClient, DetectLabelsCommand } from "@aws-sdk/client-rekognition";
import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";
import fs from "fs";
import path from "path";

// setup clients
const region = "eu-west-1";
const rekogClient = new RekognitionClient({ region });
const bedrockClient = new BedrockRuntimeClient({ region });

const testFolder = "./src/testImages";

async function runResearch() {
  try {
    const files = fs.readdirSync(testFolder).filter(file => 
      file.toLowerCase().endsWith('.jpg') || 
      file.toLowerCase().endsWith('.jpeg') || 
      file.toLowerCase().endsWith('.png')
    );
    
    console.log(`STARTING RESEARCH: ${files.length} Fish IMAGES FOUND`);

    for (const file of files) {
      const filePath = path.join(testFolder, file);
      const imageBytes = fs.readFileSync(filePath);

      // Rekognition test
      const rekogRes = await rekogClient.send(new DetectLabelsCommand({
        Image: { Bytes: imageBytes },
        MaxLabels: 5,
        MinConfidence: 70
      }));
      const rekogLabels = rekogRes.Labels.map(l => `${l.Name} (${l.Confidence.toFixed(1)}%)`).join(", ");

      // Bedrock test
      const bedrockPayload = {
        anthropic_version: "bedrock-2023-05-31",
        max_tokens: 100,
        messages: [{
          role: "user",
          content: [
            { 
              type: "image", 
              source: { 
                type: "base64", 
                media_type: "image/jpeg", 
                data: imageBytes.toString('base64') 
              } 
            },
            { 
              type: "text", 
              text: "Identify the specific species of shark in this image. Provide only the common name." 
            }
          ]
        }]
      };

      const bedrockRes = await bedrockClient.send(new InvokeModelCommand({
        modelId: "anthropic.claude-3-haiku-20240307-v1:0",
        contentType: "application/json",
        body: JSON.stringify(bedrockPayload)
      }));
      
      const bedrockData = JSON.parse(new TextDecoder().decode(bedrockRes.body));
      const bedrockResult = bedrockData.content[0].text;

      console.log(`\nFILE: ${file}`);
      console.log(`Rekognition Labels: ${rekogLabels || "No labels found"}`);
      console.log(`Bedrock Species:    ${bedrockResult.trim()}`);
      console.log(`----------------------------------------------------`);
    }
  } catch (err) {
    console.error("Error:", err);
  }
}

runResearch();