package com.Pooji.Synapse.Prep.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;

import java.io.IOException;
import java.io.InputStream;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class GeminiService {

    private final WebClient webClient;

    @Value("${gemini.api.key}")
    private String apiKey;

    public GeminiService(WebClient geminiWebClient) {
        this.webClient = geminiWebClient;
    }


    private String sendPromptToGemini(String prompt) {
        String requestJson = "{ \"contents\": [ { \"parts\": [ { \"text\": \"" +
                prompt.replace("\"", "\\\"") + "\" } ] } ] }";

        String responseJson = webClient.post()
                .uri("/v1beta/models/gemini-2.0-flash:generateContent")
                .header(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                .header("X-goog-api-key", apiKey)
                .bodyValue(requestJson)
                .retrieve()
                .bodyToMono(String.class)
                .block();

        try {
            ObjectMapper mapper = new ObjectMapper();
            // Navigate: candidates[0].content.parts[0].text
            return mapper.readTree(responseJson)
                    .path("candidates").get(0)
                    .path("content").path("parts").get(0)
                    .path("text").asText();
        } catch (Exception e) {
            return "Error parsing response: " + e.getMessage();
        }
    }




    private String extractTextFromPdf(InputStream pdfStream) throws IOException {
        try (PDDocument document = PDDocument.load(pdfStream)) {
            PDFTextStripper stripper = new PDFTextStripper();
            return stripper.getText(document);
        }
    }


    public String flashCards(String text , String QuesType,Integer NoOfQuestions) {
        String prompt =
                "Analyze the given text: " + text + "\n\nGenerate " + NoOfQuestions + " flashcards of type '" + QuesType + "'. You can refer to previous questions related to the topic if needed.\n\n" +
                        "IMPORTANT: The output MUST be a valid JSON array of objects with the following structure:\n" +
                        "1. For MCQ questions:\n" +
                        "{\n" +
                        "  \"question\": \"What is the main purpose of a queue data structure?\",\n" +
                        "  \"options\": [\"FIFO operations\", \"LIFO operations\", \"Random access\", \"Sorted storage\"],\n" +
                        "  \"answer\": \"FIFO operations\"\n" +
                        "}\n\n" +
                        "2. For True/False questions:\n" +
                        "{\n" +
                        "  \"question\": \"A stack follows FIFO (First In First Out) principle.\",\n" +
                        "  \"options\": [\"True\", \"False\"],\n" +
                        "  \"answer\": \"False\"\n" +
                        "}\n\n" +
                        "3. For Fill in the Blank, Short Answer, and Long Answer questions:\n" +
                        "{\n" +
                        "  \"question\": \"What does CPU stand for?\",\n" +
                        "  \"answer\": \"Central Processing Unit\"\n" +
                        "}\n\n" +
                        "CRITICAL REQUIREMENTS:\n" +
                        "- Always include the 'options' field as an array of strings for MCQ and True/False questions\n" +
                        "- Never include the 'options' field for Fill in the Blank, Short Answer, or Long Answer questions\n" +
                        "- Ensure all JSON is properly formatted with double quotes around keys and string values\n" +
                        "- Do not include any explanatory text before or after the JSON array"

                ;
        System.out.println(NoOfQuestions);
        System.out.println(sendPromptToGemini(prompt));
        return sendPromptToGemini(prompt);
    }

    public String flashCardsPdf(InputStream pdfStream , String QuesType,Integer NoOfQuestions) throws IOException {
        String text = extractTextFromPdf(pdfStream);
        return flashCards(text , QuesType,NoOfQuestions);
    }

}

