let currentFlashcards = [];
    let selectedFile = null;
    let testData = null;
    let currentQuestionIndex = 0;
    let userAnswers = [];
    let testTimer = null;
    let testStartTime = null;
    let testDuration = 0;

    // File handling
    function handleFileSelect(event) {
        const file = event.target.files[0];
        if (file && file.type === 'application/pdf') {
            selectedFile = file;
            document.getElementById('fileInfo').textContent = file.name;
            document.getElementById('pdfBtn').disabled = false;
        } else {
            alert('Please select a valid PDF file.');
            event.target.value = '';
        }
    }

    // Drag and drop functionality
    const fileUpload = document.getElementById('fileUpload');

    fileUpload.addEventListener('dragover', (e) => {
        e.preventDefault();
        fileUpload.classList.add('dragover');
    });

    fileUpload.addEventListener('dragleave', () => {
        fileUpload.classList.remove('dragover');
    });

    fileUpload.addEventListener('drop', (e) => {
        e.preventDefault();
        fileUpload.classList.remove('dragover');
        const file = e.dataTransfer.files[0];
        if (file && file.type === 'application/pdf') {
            selectedFile = file;
            document.getElementById('fileInfo').textContent = file.name;
            document.getElementById('pdfBtn').disabled = false;
        } else {
            alert('Please drop a valid PDF file.');
        }
    });

    // Generate flashcards from text
    async function generateFromText() {
        const text = document.getElementById('textInput').value.trim();
        const questionType = document.getElementById('questionType').value;
        const numberOfQuestions = document.getElementById('numberOfQuestions').value;

        if (!text || !questionType) {
            alert('Please enter text and select a question type.');
            return;
        }

        if (!numberOfQuestions || numberOfQuestions < 1 || numberOfQuestions > 50) {
            alert('Please enter a valid number of questions (1-50).');
            return;
        }

        showLoading(true);

        try {
            const response = await fetch('/api/gemini/Questions?QuesType=' + encodeURIComponent(questionType) + '&NoOfQuestions=' + encodeURIComponent(numberOfQuestions), {
                method: 'POST',
                headers: {
                    'Content-Type': 'text/plain',
                },
                body: text
            });

            if (response.ok) {
                const result = await response.text();
                displayFlashcards(result);
            } else {
                throw new Error('Failed to generate flashcards');
            }
        } catch (error) {
            showError('Error generating flashcards: ' + error.message);
        } finally {
            showLoading(false);
        }
    }

    // Generate flashcards from PDF
    async function generateFromPdf() {
        if (!selectedFile) {
            alert('Please select a PDF file first.');
            return;
        }

        const questionType = document.getElementById('pdfQuestionType').value;
        const numberOfQuestions = document.getElementById('pdfNumberOfQuestions').value;
        if (!questionType) {
            alert('Please select a question type.');
            return;
        }

        if (!numberOfQuestions || numberOfQuestions < 1 || numberOfQuestions > 50) {
            alert('Please enter a valid number of questions (1-50).');
            return;
        }

        showLoading(true);

        const formData = new FormData();
        formData.append('file', selectedFile);

        try {
            const response = await fetch('/api/gemini/Questions/pdf?QuesType=' + encodeURIComponent(questionType) + '&NoOfQuestions=' + encodeURIComponent(numberOfQuestions), {
                method: 'POST',
                body: formData
            });

            if (response.ok) {
                const result = await response.text();
                displayFlashcards(result);
            } else {
                throw new Error('Failed to generate flashcards from PDF');
            }
        } catch (error) {
            showError('Error generating flashcards from PDF: ' + error.message);
        } finally {
            showLoading(false);
        }
    }

    // Display flashcards
    function displayFlashcards(result) {
        try {
            // Log the raw response for debugging
            console.log('Raw response:', result);

            // Try to parse the result as JSON
            let flashcards;
            try {
                const parsedResult = JSON.parse(result);
                console.log('Parsed result:', parsedResult);

                // Check if the response is already an array of flashcards
                if (Array.isArray(parsedResult)) {
                    flashcards = parsedResult;
                }
                // Check if it's the new format with a Questions array
                else if (parsedResult.Questions && Array.isArray(parsedResult.Questions)) {
                    flashcards = parsedResult.Questions;
                }
                // If it's neither, throw an error
                else {
                    throw new Error('Response format not recognized');
                }
            } catch (e) {
                // If it's not valid JSON, try to extract JSON from the response
                const jsonMatch = result.match(/\[.*\]/s);
                if (jsonMatch) {
                    flashcards = JSON.parse(jsonMatch[0]);
                } else {
                    throw new Error('Invalid response format');
                }
            }

            if (!Array.isArray(flashcards)) {
                throw new Error('Response is not an array');
            }

            console.log('Flashcards before normalization:', flashcards);

            // Normalize the flashcards to ensure consistent property names
            flashcards = flashcards.map(card => {
                // Extract options from the question text if they exist in the old format
                let extractedOptions = [];
                let questionText = card.Question || card.question || '';

                // Check if options are in the question text (old format)
                const optionsMatch = questionText.match(/Options:(.*)/s);
                if (optionsMatch) {
                    const optionsText = optionsMatch[1];
                    // Extract options using regex pattern for numbered options
                    const optionMatches = optionsText.match(/\d+\.\s*([^\d\.]+)(?=\s*\d+\.|$)/g);
                    if (optionMatches) {
                        extractedOptions = optionMatches.map(opt => {
                            // Remove the number and leading/trailing whitespace
                            return opt.replace(/^\d+\.\s*/, '').trim();
                        });
                    }

                    // Remove the Options: section from the question text
                    questionText = questionText.replace(/Options:.*$/s, '').trim();
                }

                // Handle different formats of options
                let options = [];
                let questionType = (card.type || '').toLowerCase();

                // Priority order for options:
                // 1. Check for options array (lowercase)
                if (card.options && Array.isArray(card.options) && card.options.length > 0) {
                    options = card.options;
                }
                // 2. Check for Options array (capitalized)
                else if (card.Options && Array.isArray(card.Options) && card.Options.length > 0) {
                    options = card.Options;
                }
                // 3. Extract from question text (old format)
                else if (extractedOptions.length > 0) {
                    options = extractedOptions;
                }
                // 4. Default to True/False for True/False questions
                else if (questionType.includes('true') || questionType.includes('false') ||
                        ((card.Question || card.question || '').toLowerCase().includes('true') &&
                         (card.Question || card.question || '').toLowerCase().includes('false'))) {
                    options = ['True', 'False'];
                }
                // 5. Default to empty options for Fill in the Blank, Short Answer, and Long Answer
                else if (questionType.includes('fill') || questionType.includes('short') || questionType.includes('long')) {
                    options = [];
                }
                // 6. Default to MCQ with placeholder if no options found but type is MCQ
                else if (questionType.includes('mcq') || questionType.includes('choice')) {
                    options = ['Option A', 'Option B', 'Option C', 'Option D'];
                }

                const normalized = {
                    question: questionText,
                    answer: card.Answer || card.answer || '',
                    options: options
                };

                console.log('Original card:', card);
                console.log('Normalized card:', normalized);
                return normalized;
            });

            currentFlashcards = flashcards;
            const grid = document.getElementById('flashcardsGrid');
            grid.innerHTML = '';

            flashcards.forEach((card, index) => {
                const flashcardElement = createFlashcardElement(card, index);
                grid.appendChild(flashcardElement);
            });

            document.getElementById('resultsSection').style.display = 'block';
            // Auto-scroll to bottom of the page to show results
            window.scrollTo({
                top: document.body.scrollHeight,
                behavior: 'smooth'
            });
        } catch (error) {
            showError('Error parsing flashcards: ' + error.message + '<br><br>Raw response: ' + result);
        }
    }

    // Create individual flashcard element
    function createFlashcardElement(card, index) {
        const div = document.createElement('div');
        div.className = 'flashcard';
        div.onclick = () => div.classList.toggle('flipped');

        // Format options if they exist
        let optionsHtml = '';
        if (card.options && Array.isArray(card.options) && card.options.length > 0) {
            optionsHtml = '<div class="options"><ul>';
            card.options.forEach(option => {
                optionsHtml += `<li>${option}</li>`;
            });
            optionsHtml += '</ul></div>';
        }

        div.innerHTML = `
            <div class="question">
                <h4>Question ${index + 1}:</h4>
                <p>${card.question || 'No question provided'}</p>
                ${optionsHtml}
                <div class="flip-hint">Click to see answer</div>
            </div>
            <div class="answer">
                <h4>Answer ${index + 1}:</h4>
                <p>${card.answer || 'No answer provided'}</p>
                <div class="flip-hint">Click to see question</div>
            </div>
        `;

        return div;
    }

    // Show/hide loading
    function showLoading(show) {
        document.getElementById('loading').style.display = show ? 'block' : 'none';
    }

    // Show error message
    function showError(message) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.innerHTML = message;

        const mainContent = document.querySelector('.main-content');
        mainContent.appendChild(errorDiv);

        setTimeout(() => {
            errorDiv.remove();
        }, 10000);
    }

    // Test Functions
    function takeTest() {
        if (!currentFlashcards || currentFlashcards.length === 0) {
            alert('Please generate flashcards first before taking a test.');
            return;
        }

        // Get the number of questions from the appropriate input field
        let numberOfQuestions = 10; // Default value
        if (document.getElementById('numberOfQuestions')) {
            numberOfQuestions = parseInt(document.getElementById('numberOfQuestions').value);
        } else if (document.getElementById('pdfNumberOfQuestions')) {
            numberOfQuestions = parseInt(document.getElementById('pdfNumberOfQuestions').value);
        }

        // Get the question type
        const questionType = getQuestionType();
        console.log('Taking test with question type:', questionType);

        // Prepare questions for the test
        const questions = currentFlashcards.map(card => {
            // Ensure each question has the correct type property
            const hasOptions = card.options && Array.isArray(card.options) && card.options.length > 0;

            // Determine the specific question type based on options and selected type
            let questionType = getQuestionType();
            if (hasOptions) {
                if (card.options.length === 2 &&
                    card.options.includes('True') && card.options.includes('False')) {
                    questionType = 'true/false';
                } else {
                    questionType = 'mcq';
                }
            } else if (questionType.toLowerCase().includes('fill')) {
                questionType = 'fill';
            } else if (questionType.toLowerCase().includes('short')) {
                questionType = 'short';
            } else if (questionType.toLowerCase().includes('long')) {
                questionType = 'long';
            }

            return {
                ...card,
                type: questionType,
                hasOptions: hasOptions
            };
        });

        // Store test data in localStorage for the new page
        const testData = {
            questions: questions,
            totalQuestions: questions.length,
            questionType: questionType,
            numberOfQuestions: numberOfQuestions,
            hasOptions: questions.some(q => q.hasOptions)
        };

        console.log('Storing test data:', testData);
        localStorage.setItem('testData', JSON.stringify(testData));

        // Navigate to test page
        window.location.href = '/test.html';
    }



    function closeTestInterface() {
        if (confirm('Are you sure you want to exit the test? All progress will be lost.')) {
            stopTestTimer();
            document.getElementById('testInterfaceModal').style.display = 'none';
            resetTest();
        }
    }

    function startTestTimer() {
        testTimer = setInterval(() => {
            const elapsed = Math.floor((Date.now() - testStartTime) / 1000);
            const remaining = testDuration - elapsed;

            if (remaining <= 0) {
                // Time's up
                stopTestTimer();
                submitTest();
                return;
            }

            const minutes = Math.floor(remaining / 60);
            const seconds = remaining % 60;
            document.getElementById('timer').textContent =
                `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

            // Update progress bar
            const progress = ((elapsed / testDuration) * 100);
            document.getElementById('progressFill').style.width = `${progress}%`;
        }, 1000);
    }

    function stopTestTimer() {
        if (testTimer) {
            clearInterval(testTimer);
            testTimer = null;
        }
    }

    function displayQuestion() {
        const question = testData.questions[currentQuestionIndex];
        const questionContainer = document.getElementById('questionContainer');

        // Update question number
        document.getElementById('currentQuestionNum').textContent = currentQuestionIndex + 1;
        document.getElementById('totalQuestionsTest').textContent = testData.totalQuestions;

        // Create question display
        let questionHTML = `
            <div class="question-text">${question.question}</div>
            <div class="options-container">
        `;

        // Extract options from MCQ questions
        if (question.question.includes('Options:')) {
            const optionsMatch = question.question.match(/Options:(.*)/);
            if (optionsMatch) {
                const optionsText = optionsMatch[1];
                const options = optionsText.split(/\d+\./).filter(opt => opt.trim());

                options.forEach((option, index) => {
                    const optionText = option.trim();
                    if (optionText) {
                        const isSelected = userAnswers[currentQuestionIndex] === index;
                        questionHTML += `
                            <div class="option-item ${isSelected ? 'selected' : ''}" onclick="selectOption(${index})">
                                <input type="radio" name="q${currentQuestionIndex}" value="${index}"
                                       ${isSelected ? 'checked' : ''} onchange="selectOption(${index})">
                                <label>${optionText}</label>
                            </div>
                        `;
                    }
                });
            }
        } else {
            // For non-MCQ questions, create simple radio buttons
            questionHTML += `
                <div class="option-item ${userAnswers[currentQuestionIndex] === 0 ? 'selected' : ''}" onclick="selectOption(0)">
                    <input type="radio" name="q${currentQuestionIndex}" value="0"
                           ${userAnswers[currentQuestionIndex] === 0 ? 'checked' : ''} onchange="selectOption(0)">
                    <label>True</label>
                </div>
                <div class="option-item ${userAnswers[currentQuestionIndex] === 1 ? 'selected' : ''}" onclick="selectOption(1)">
                    <input type="radio" name="q${currentQuestionIndex}" value="1"
                           ${userAnswers[currentQuestionIndex] === 1 ? 'checked' : ''} onchange="selectOption(1)">
                    <label>False</label>
                </div>
            `;
        }

        questionHTML += '</div>';
        questionContainer.innerHTML = questionHTML;

        // Update navigation buttons
        updateNavigationButtons();
    }

    function selectOption(optionIndex) {
        userAnswers[currentQuestionIndex] = optionIndex;

        // Update visual selection
        const optionItems = document.querySelectorAll('.option-item');
        optionItems.forEach((item, index) => {
            item.classList.toggle('selected', index === optionIndex);
        });

        // Update radio button
        const radioButtons = document.querySelectorAll(`input[name="q${currentQuestionIndex}"]`);
        radioButtons.forEach((radio, index) => {
            radio.checked = (index === optionIndex);
        });
    }

    function updateNavigationButtons() {
        const prevBtn = document.getElementById('prevBtn');
        const nextBtn = document.getElementById('nextBtn');
        const submitBtn = document.getElementById('submitBtn');

        prevBtn.disabled = currentQuestionIndex === 0;

        if (currentQuestionIndex === testData.totalQuestions - 1) {
            nextBtn.style.display = 'none';
            submitBtn.style.display = 'inline-flex';
        } else {
            nextBtn.style.display = 'inline-flex';
            submitBtn.style.display = 'none';
        }
    }

    function previousQuestion() {
        if (currentQuestionIndex > 0) {
            currentQuestionIndex--;
            displayQuestion();
        }
    }

    function nextQuestion() {
        if (currentQuestionIndex < testData.totalQuestions - 1) {
            currentQuestionIndex++;
            displayQuestion();
        }
    }

    function submitTest() {
        stopTestTimer();

        // Calculate results
        const results = calculateTestResults();

        // Display results
        displayTestResults(results);

        // Close test interface and show results
        document.getElementById('testInterfaceModal').style.display = 'none';
        document.getElementById('resultsModal').style.display = 'block';
    }

    function calculateTestResults() {
        let correct = 0;
        let incorrect = 0;
        const timeTaken = Math.floor((Date.now() - testStartTime) / 1000);

        userAnswers.forEach((userAnswer, index) => {
            const question = testData.questions[index];
            const correctAnswer = question.answer;

            // Simple answer validation (can be enhanced)
            if (userAnswer !== null) {
                if (question.question.includes('Options:')) {
                    // For MCQ, check if selected option matches answer
                    const optionsMatch = question.question.match(/Options:(.*)/);
                    if (optionsMatch) {
                        const optionsText = optionsMatch[1];
                        const options = optionsText.split(/\d+\./).filter(opt => opt.trim());
                        const selectedOption = options[userAnswer]?.trim();

                        if (selectedOption === correctAnswer) {
                            correct++;
                        } else {
                            incorrect++;
                        }
                    }
                } else {
                    // For True/False, check if answer matches
                    if ((userAnswer === 0 && correctAnswer.toLowerCase().includes('true')) ||
                        (userAnswer === 1 && correctAnswer.toLowerCase().includes('false'))) {
                        correct++;
                    } else {
                        incorrect++;
                    }
                }
            } else {
                incorrect++;
            }
        });

        return {
            correct,
            incorrect,
            total: testData.totalQuestions,
            score: correct,
            percentage: Math.round((correct / testData.totalQuestions) * 100),
            timeTaken,
            userAnswers: [...userAnswers]
        };
    }

    function displayTestResults(results) {
        document.getElementById('scoreDisplay').textContent = results.score;
        document.getElementById('totalScore').textContent = results.total;
        document.getElementById('percentageDisplay').textContent = results.percentage + '%';
        document.getElementById('correctAnswers').textContent = results.correct;
        document.getElementById('incorrectAnswers').textContent = results.incorrect;

        const timeMinutes = Math.floor(results.timeTaken / 60);
        const timeSeconds = results.timeTaken % 60;
        document.getElementById('timeTaken').textContent =
            `${timeMinutes}:${timeSeconds.toString().padStart(2, '0')}`;

        // Display question review
        displayQuestionReview(results);
    }

    function displayQuestionReview(results) {
        const reviewContainer = document.getElementById('questionReview');
        let reviewHTML = '<h3>Question Review</h3>';

        testData.questions.forEach((question, index) => {
            const userAnswer = results.userAnswers[index];
            const correctAnswer = question.answer;
            let isCorrect = false;
            let userAnswerText = 'Not answered';

            if (userAnswer !== null) {
                if (question.question.includes('Options:')) {
                    const optionsMatch = question.question.match(/Options:(.*)/);
                    if (optionsMatch) {
                        const optionsText = optionsMatch[1];
                        const options = optionsText.split(/\d+\./).filter(opt => opt.trim());
                        userAnswerText = options[userAnswer]?.trim() || 'Invalid option';
                        isCorrect = (userAnswerText === correctAnswer);
                    }
                } else {
                    userAnswerText = userAnswer === 0 ? 'True' : 'False';
                    isCorrect = ((userAnswer === 0 && correctAnswer.toLowerCase().includes('true')) ||
                               (userAnswer === 1 && correctAnswer.toLowerCase().includes('false')));
                }
            }

            reviewHTML += `
                <div class="review-item">
                    <div class="review-question">Question ${index + 1}: ${question.question}</div>
                    <div class="review-answer"><strong>Correct Answer:</strong> ${correctAnswer}</div>
                    <div class="review-user-answer">
                        <strong>Your Answer:</strong>
                        <span class="${isCorrect ? 'correct' : 'incorrect'}">${userAnswerText}</span>
                    </div>
                </div>
            `;
        });

        reviewContainer.innerHTML = reviewHTML;
    }

    function closeResultsModal() {
        document.getElementById('resultsModal').style.display = 'none';
        resetTest();
    }

    function resetTest() {
        testData = null;
        currentQuestionIndex = 0;
        userAnswers = [];
        testStartTime = null;
        testDuration = 0;
        stopTestTimer();
    }

    function exportTestResults() {
        // Export test results as PDF
        const results = calculateTestResults();

        // Create PDF content using jsPDF
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

        // Add title
        doc.setFontSize(20);
        doc.text('Test Results', 105, 20, { align: 'center' });

        // Add test info
        doc.setFontSize(14);
        doc.text(`Test Type: ${getQuestionType()}`, 105, 35, { align: 'center' });
        doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 105, 45, { align: 'center' });

        // Add results summary
        doc.setFontSize(16);
        doc.text('Results Summary', 20, 65);

        doc.setFontSize(12);
        doc.text(`Score: ${results.score}/${results.total}`, 20, 80);
        doc.text(`Percentage: ${results.percentage}%`, 20, 90);
        doc.text(`Correct Answers: ${results.correct}`, 20, 100);
        doc.text(`Incorrect Answers: ${results.incorrect}`, 20, 110);

        const timeMinutes = Math.floor(results.timeTaken / 60);
        const timeSeconds = results.timeTaken % 60;
        doc.text(`Time Taken: ${timeMinutes}:${timeSeconds.toString().padStart(2, '0')}`, 20, 120);

        // Add question review
        let yPosition = 140;
        const pageHeight = doc.internal.pageSize.height;
        const margin = 20;

        doc.setFontSize(14);
        doc.text('Question Review', 20, yPosition);
        yPosition += 15;

        testData.questions.forEach((question, index) => {
            // Check if we need a new page
            if (yPosition > pageHeight - 40) {
                doc.addPage();
                yPosition = 20;
            }

            const userAnswer = results.userAnswers[index];
            const correctAnswer = question.answer;
            let isCorrect = false;
            let userAnswerText = 'Not answered';

            if (userAnswer !== null) {
                if (question.question.includes('Options:')) {
                    const optionsMatch = question.question.match(/Options:(.*)/);
                    if (optionsMatch) {
                        const optionsText = optionsMatch[1];
                        const options = optionsText.split(/\d+\./).filter(opt => opt.trim());
                        userAnswerText = options[userAnswer]?.trim() || 'Invalid option';
                        isCorrect = (userAnswerText === correctAnswer);
                    }
                } else {
                    userAnswerText = userAnswer === 0 ? 'True' : 'False';
                    isCorrect = ((userAnswer === 0 && correctAnswer.toLowerCase().includes('true')) ||
                               (results.userAnswers[index] === 1 && correctAnswer.toLowerCase().includes('false')));
                }
            }

            // Add question
            doc.setFontSize(12);
            doc.setFont(undefined, 'bold');
            doc.text(`Question ${index + 1}:`, margin, yPosition);
            yPosition += 8;

            doc.setFont(undefined, 'normal');
            const questionLines = doc.splitTextToSize(question.question, 170);
            doc.text(questionLines, margin, yPosition);
            yPosition += questionLines.length * 7 + 5;

            // Add answers
            doc.setFont(undefined, 'bold');
            doc.text(`Correct Answer: ${correctAnswer}`, margin, yPosition);
            yPosition += 8;

            doc.setFont(undefined, 'normal');
            doc.text(`Your Answer: ${userAnswerText}`, margin, yPosition);
            yPosition += 8;

            // Add result indicator
            doc.setFont(undefined, 'bold');
            doc.text(`Result: ${isCorrect ? 'CORRECT' : 'INCORRECT'}`, margin, yPosition);
            yPosition += 15;
        });

        // Save the PDF
        doc.save('test-results.pdf');
    }

    // PDF Export Functions
    function exportToPDF() {
        if (!currentFlashcards || currentFlashcards.length === 0) {
            alert('Please generate flashcards first before exporting to PDF.');
            return;
        }

        // Create PDF content using jsPDF
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

        // Add title
        doc.setFontSize(20);
        doc.text('AI Generated Flashcards', 105, 20, { align: 'center' });

        // Add subtitle
        doc.setFontSize(14);
        doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 105, 30, { align: 'center' });
        doc.text(`Total Questions: ${currentFlashcards.length}`, 105, 40, { align: 'center' });

        let yPosition = 60;
        const pageHeight = doc.internal.pageSize.height;
        const margin = 20;

        currentFlashcards.forEach((card, index) => {
            // Check if we need a new page
            if (yPosition > pageHeight - 40) {
                doc.addPage();
                yPosition = 20;
            }

            // Add question
            doc.setFontSize(12);
            doc.setFont(undefined, 'bold');
            doc.text(`Question ${index + 1}:`, margin, yPosition);
            yPosition += 10;

            doc.setFont(undefined, 'normal');
            const questionLines = doc.splitTextToSize(card.question || 'No question provided', 170);
            doc.text(questionLines, margin, yPosition);
            yPosition += questionLines.length * 7 + 10;

            // Add answer
            doc.setFont(undefined, 'bold');
            doc.text(`Answer ${index + 1}:`, margin, yPosition);
            yPosition += 10;

            doc.setFont(undefined, 'normal');
            const answerLines = doc.splitTextToSize(card.answer || 'No answer provided', 170);
            doc.text(answerLines, margin, yPosition);
            yPosition += answerLines.length * 7 + 15;
        });

        // Save the PDF
        doc.save('ai-flashcards.pdf');
    }

    function getQuestionType() {
        const questionType = document.getElementById('questionType').value ||
                           document.getElementById('pdfQuestionType').value;
        return questionType || 'MCQ';
    }

    function downloadFile(blob, filename) {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    }

    // Close modals when clicking outside
    window.onclick = function(event) {
        const modals = document.querySelectorAll('.modal');
        modals.forEach(modal => {
            if (event.target === modal) {
                modal.style.display = 'none';
            }
        });
    }

    // Scroll to top function
    function scrollToTop() {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    }

    // Simple Carousel
    (function initCarousel() {
        const track = document.getElementById('carouselTrack');
        const dotsContainer = document.getElementById('carouselDots');
        if (!track || !dotsContainer) return;
        const slides = Array.from(track.children);
        let index = 0;

        // Dots
        slides.forEach((_, i) => {
            const dot = document.createElement('button');
            dot.className = 'carousel-dot' + (i === 0 ? ' active' : '');
            dot.onclick = () => goTo(i);
            dotsContainer.appendChild(dot);
        });

        function goTo(i) {
            index = i % slides.length;
            track.style.transform = `translateX(-${index * 100}%)`;
            Array.from(dotsContainer.children).forEach((d, di) => {
                d.classList.toggle('active', di === index);
            });
        }

        setInterval(() => goTo((index + 1) % slides.length), 5000);
    })();