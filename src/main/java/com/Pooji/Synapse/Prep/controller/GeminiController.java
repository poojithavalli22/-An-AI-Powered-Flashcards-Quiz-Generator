package com.Pooji.Synapse.Prep.controller;


import com.Pooji.Synapse.Prep.service.GeminiService;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/gemini")
public class GeminiController {

    private final GeminiService geminiService;

    public GeminiController(GeminiService geminiService) {
        this.geminiService = geminiService;
    }
    @PostMapping(value = "/Questions", consumes = MediaType.TEXT_PLAIN_VALUE)
    public String flashCards(@RequestBody String text, @RequestParam String QuesType,@RequestParam Integer NoOfQuestions) {
        System.out.println("Received text for translation: " + text);
        return geminiService.flashCards(text, QuesType,NoOfQuestions);
    }

    @PostMapping(value = "/Questions/pdf", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public String flashCardsPdf(@RequestPart("file") MultipartFile file, @RequestParam String QuesType,@RequestParam Integer NoOfQuestions) throws IOException {
        return geminiService.flashCardsPdf(file.getInputStream(), QuesType,NoOfQuestions);
    }
}

