let testData = null;
  let currentQuestionIndex = 0;
  let userAnswers = [];
  let testTimer = null;
  let testStartTime = null;
  let testDuration = 0;

  // Carousel variables
  let currentSlide = 0;
  let carouselInterval;

  // Initialize test page
  window.onload = function() {
      loadTestData();
      startCarousel();
  };

  function loadTestData() {
      const storedData = localStorage.getItem('testData');
      if (!storedData) {
          alert('No test data found. Please go back and generate flashcards first.');
          return;
      }

      try {
          testData = JSON.parse(storedData);
          console.log('Loaded test data:', testData); // Debug log

          // Update the test information display
          if (document.getElementById('totalQuestions')) {
              document.getElementById('totalQuestions').textContent = testData.totalQuestions || 0;
          }

          if (document.getElementById('questionType')) {
              document.getElementById('questionType').textContent = testData.questionType || 'Unknown';
          }

          // Update total questions in test interface
          if (document.getElementById('totalQuestionsTest')) {
              document.getElementById('totalQuestionsTest').textContent = testData.totalQuestions || 0;
          }
      } catch (error) {
          console.error('Error parsing test data:', error);
          alert('Error loading test data. Please try again.');
          goBack();
      }
  }

  function goBack() {
      localStorage.removeItem('testData');
      window.location.href = '/index.html';
  }

  function startTest() {
      if (!testData || !testData.questions || testData.questions.length === 0) {
          alert('No test data available. Please go back and generate flashcards first.');
          goBack();
          return;
      }

      testDuration = parseInt(document.getElementById('testTime').value) * 60; // Convert to seconds
      testStartTime = Date.now();

      // Initialize user answers
      userAnswers = new Array(testData.questions.length).fill(null);
      currentQuestionIndex = 0;

      // Update total questions display
      document.getElementById('totalQuestionsTest').textContent = testData.questions.length;

      // Hide config and show test interface
      document.getElementById('testConfig').style.display = 'none';
      document.getElementById('testInterface').style.display = 'block';

      // Start timer
      startTestTimer();

      // Display first question
      displayQuestion();
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

      // Log the question for debugging
      console.log('Current question:', question);

      // Create question display
      let questionHTML = `
          <div class="question-text">${question.question}</div>
          <div class="options-container">
      `;

      const qType = (testData.questionType || '').toLowerCase();
      const hasOptions = question.options && Array.isArray(question.options) && question.options.length > 0;
      console.log('Has options:', hasOptions, 'Options:', question.options);

      // Determine question type based on selected type and available options
      let isMCQ = false;
      let isTrueFalse = false;
      let isFillBlank = false;
      let isShort = false;
      let isLong = false;

      // First check if this specific question has a specific type property
      if (question.type) {
          isMCQ = question.type === 'mcq';
          isTrueFalse = question.type === 'true/false';
          isFillBlank = question.type === 'fill';
          isShort = question.type === 'short';
          isLong = question.type === 'long';
      }
      // Then check if this specific question has options
      else if (hasOptions) {
          // If options are present, it's an MCQ
          isMCQ = true;
      }
      // Then check the selected question type
      else if (qType.includes('mcq') || qType.includes('choice')) {
          isMCQ = true;
      }
      else if (qType.includes('true') || qType.includes('false')) {
          isTrueFalse = true;
      }
      else if (qType.includes('fill')) {
          isFillBlank = true;
      }
      else if (qType.includes('short')) {
          isShort = true;
      }
      else if (qType.includes('long')) {
          isLong = true;
      }
      // Default to MCQ if no specific type is matched
      else {
          isMCQ = true;
      }

      if (isMCQ) {
          // Check if we have options in the new format
          if (question.options && Array.isArray(question.options) && question.options.length > 0) {
              question.options.forEach((option, index) => {
                  const optionText = option.trim();
                  if (optionText) {
                      const isSelected = userAnswers[currentQuestionIndex] === index;
                      questionHTML += `
                          <div class="option-item ${isSelected ? 'selected' : ''}" onclick="selectOption(${index})">
                              <input type="radio" name="q${currentQuestionIndex}" value="${index}" ${isSelected ? 'checked' : ''} onchange="selectOption(${index})">
                              <label>${optionText}</label>
                          </div>
                      `;
                  }
              });
          }
          // Fallback to the old format if no options array is available
          else {
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
                                  <input type="radio" name="q${currentQuestionIndex}" value="${index}" ${isSelected ? 'checked' : ''} onchange="selectOption(${index})">
                                  <label>${optionText}</label>
                              </div>
                          `;
                      }
                  });
              }
          }
      } else if (isTrueFalse) {
          questionHTML += `
              <div class="option-item ${userAnswers[currentQuestionIndex] === 0 ? 'selected' : ''}" onclick="selectOption(0)">
                  <input type="radio" name="q${currentQuestionIndex}" value="0" ${userAnswers[currentQuestionIndex] === 0 ? 'checked' : ''} onchange="selectOption(0)">
                  <label>True</label>
              </div>
              <div class="option-item ${userAnswers[currentQuestionIndex] === 1 ? 'selected' : ''}" onclick="selectOption(1)">
                  <input type="radio" name="q${currentQuestionIndex}" value="1" ${userAnswers[currentQuestionIndex] === 1 ? 'checked' : ''} onchange="selectOption(1)">
                  <label>False</label>
              </div>
          `;
      } else if (isFillBlank) {
          const existing = typeof userAnswers[currentQuestionIndex] === 'string' ? userAnswers[currentQuestionIndex] : '';
          questionHTML += `
              <div class="form-group">
                  <label><strong>Your Answer:</strong></label>
                  <input type="text" class="form-control" value="${existing.replace(/"/g, '&quot;')}" oninput="setTextAnswer(this.value)">
              </div>
          `;
      } else if (isShort || isLong) {
          const existing = typeof userAnswers[currentQuestionIndex] === 'string' ? userAnswers[currentQuestionIndex] : '';
          questionHTML += `
              <div class="form-group">
                  <label><strong>Your Answer:</strong></label>
                  <textarea class="form-control" rows="${isLong ? 5 : 3}" oninput="setTextAnswer(this.value)">${existing.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</textarea>
              </div>
          `;
      } else {
          // Default to True/False if type isn't recognized
          questionHTML += `
              <div class="option-item ${userAnswers[currentQuestionIndex] === 0 ? 'selected' : ''}" onclick="selectOption(0)">
                  <input type="radio" name="q${currentQuestionIndex}" value="0" ${userAnswers[currentQuestionIndex] === 0 ? 'checked' : ''} onchange="selectOption(0)">
                  <label>True</label>
              </div>
              <div class="option-item ${userAnswers[currentQuestionIndex] === 1 ? 'selected' : ''}" onclick="selectOption(1)">
                  <input type="radio" name="q${currentQuestionIndex}" value="1" ${userAnswers[currentQuestionIndex] === 1 ? 'checked' : ''} onchange="selectOption(1)">
                  <label>False</label>
              </div>
          `;
      }

      questionHTML += '</div>';
      questionContainer.innerHTML = questionHTML;

      // Update navigation buttons
      updateNavigationButtons();
  }

  function setTextAnswer(value) {
      userAnswers[currentQuestionIndex] = value;
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

      // Hide test interface and show results
      document.getElementById('testInterface').style.display = 'none';
      document.getElementById('resultsSection').style.display = 'block';
  }

  function calculateTestResults() {
      let correct = 0;
      let incorrect = 0;
      const timeTaken = Math.floor((Date.now() - testStartTime) / 1000);
      const qType = (testData.questionType || '').toLowerCase();
      const isFillBlankType = qType.includes('fill');
      const isShortType = qType.includes('short');
      const isLongType = qType.includes('long');
      const isTrueFalseType = qType.includes('true') || qType.includes('false');

      userAnswers.forEach((userAnswer, index) => {
          const question = testData.questions[index];
          const correctAnswer = question.answer;

          // Validation
          if (userAnswer === null || userAnswer === undefined || userAnswer === '') {
              incorrect++;
              return;
          }

          // Check if we have options in the new format
          const hasOptions = question.options && Array.isArray(question.options) && question.options.length > 0;

          if (hasOptions && !(isFillBlankType || isShortType || isLongType)) {
              // MCQ with options array format
              const selectedOption = question.options[userAnswer]?.trim();
              if ((selectedOption || '').trim() === (correctAnswer || '').trim()) {
                  correct++;
              } else {
                  incorrect++;
              }
          } else if (question.question.includes('Options:') && !(isFillBlankType || isShortType || isLongType)) {
              // MCQ with old format (options embedded in question text)
              const optionsMatch = question.question.match(/Options:(.*)/);
              if (optionsMatch) {
                  const optionsText = optionsMatch[1];
                  const options = optionsText.split(/\d+\./).filter(opt => opt.trim());
                  const selectedOption = options[userAnswer]?.trim();
                  if ((selectedOption || '').trim() === (correctAnswer || '').trim()) {
                      correct++;
                  } else {
                      incorrect++;
                  }
              } else {
                  incorrect++;
              }
          } else if (isTrueFalseType) {
              // True/False
              if ((userAnswer === 0 && (correctAnswer || '').toLowerCase().includes('true')) ||
                  (userAnswer === 1 && (correctAnswer || '').toLowerCase().includes('false'))) {
                  correct++;
              } else {
                  incorrect++;
              }
          } else if (isFillBlankType || isShortType || isLongType) {
              // Text-based answers: compare normalized strings
              const normalize = (s) => (s || '')
                  .toString()
                  .trim()
                  .toLowerCase()
                  .replace(/\s+/g, ' ');
              if (normalize(userAnswer) === normalize(correctAnswer)) {
                  correct++;
              } else {
                  incorrect++;
              }
          } else {
              // Fallback to simple contains check
              const ua = (userAnswer + '').toLowerCase();
              const ca = (correctAnswer + '').toLowerCase();
              if (ua && ca && (ua === ca)) {
                  correct++;
              } else {
                  incorrect++;
              }
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
      const qType = (testData.questionType || '').toLowerCase();
      const isFillBlankType = qType.includes('fill');
      const isShortType = qType.includes('short');
      const isLongType = qType.includes('long');
      const isTrueFalseType = qType.includes('true') || qType.includes('false');
      const normalize = (s) => (s || '').toString().trim().toLowerCase().replace(/\s+/g, ' ');

      testData.questions.forEach((question, index) => {
          const userAnswer = results.userAnswers[index];
          const correctAnswer = question.answer;
          let isCorrect = false;
          let userAnswerText = 'Not answered';

          if (userAnswer !== null && userAnswer !== undefined && userAnswer !== '') {
              // Check if we have options in the new format
          const hasOptions = question.options && Array.isArray(question.options) && question.options.length > 0;

          if (hasOptions && !(isFillBlankType || isShortType || isLongType)) {
              // MCQ with options array format
              userAnswerText = question.options[userAnswer]?.trim() || 'Invalid option';
              isCorrect = (normalize(userAnswerText) === normalize(correctAnswer));
          } else if (question.question.includes('Options:') && !(isFillBlankType || isShortType || isLongType)) {
              // MCQ with old format (options embedded in question text)
              const optionsMatch = question.question.match(/Options:(.*)/);
              if (optionsMatch) {
                  const optionsText = optionsMatch[1];
                  const options = optionsText.split(/\d+\./).filter(opt => opt.trim());
                  userAnswerText = options[userAnswer]?.trim() || 'Invalid option';
                  isCorrect = (normalize(userAnswerText) === normalize(correctAnswer));
              }
              } else if (isTrueFalseType) {
                  userAnswerText = userAnswer === 0 ? 'True' : 'False';
                  isCorrect = ((userAnswer === 0 && (correctAnswer || '').toLowerCase().includes('true')) ||
                             (userAnswer === 1 && (correctAnswer || '').toLowerCase().includes('false')));
              } else if (isFillBlankType || isShortType || isLongType) {
                  userAnswerText = (userAnswer + '');
                  isCorrect = (normalize(userAnswerText) === normalize(correctAnswer));
              } else {
                  userAnswerText = (userAnswer + '');
                  isCorrect = (normalize(userAnswerText) === normalize(correctAnswer));
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
      doc.text(`Test Type: ${testData.questionType}`, 105, 35, { align: 'center' });
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
      const qType = (testData.questionType || '').toLowerCase();
      const isFillBlankType = qType.includes('fill');
      const isShortType = qType.includes('short');
      const isLongType = qType.includes('long');
      const isTrueFalseType = qType.includes('true') || qType.includes('false');
      const normalize = (s) => (s || '').toString().trim().toLowerCase().replace(/\s+/g, ' ');

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

          if (userAnswer !== null && userAnswer !== undefined && userAnswer !== '') {
              if (question.question.includes('Options:') && !(isFillBlankType || isShortType || isLongType)) {
                  const optionsMatch = question.question.match(/Options:(.*)/);
                  if (optionsMatch) {
                      const optionsText = optionsMatch[1];
                      const options = optionsText.split(/\d+\./).filter(opt => opt.trim());
                      userAnswerText = options[userAnswer]?.trim() || 'Invalid option';
                      isCorrect = (normalize(userAnswerText) === normalize(correctAnswer));
                  }
              } else if (isTrueFalseType) {
                  userAnswerText = userAnswer === 0 ? 'True' : 'False';
                  isCorrect = ((userAnswer === 0 && (correctAnswer || '').toLowerCase().includes('true')) ||
                             (userAnswer === 1 && (correctAnswer || '').toLowerCase().includes('false')));
              } else if (isFillBlankType || isShortType || isLongType) {
                  userAnswerText = (userAnswer + '');
                  isCorrect = (normalize(userAnswerText) === normalize(correctAnswer));
              } else {
                  userAnswerText = (userAnswer + '');
                  isCorrect = (normalize(userAnswerText) === normalize(correctAnswer));
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

  // Carousel functions
  function startCarousel() {
      carouselInterval = setInterval(() => {
          nextSlide();
      }, 4000);
  }

  function showSlides(n) {
      const slides = document.querySelectorAll('.carousel-slide');
      const dots = document.querySelectorAll('.carousel-dot');

      // Handle looping
      if (n >= slides.length) n = 0;
      if (n < 0) n = slides.length - 1;

      slides.forEach(slide => slide.classList.remove('active'));
      dots.forEach(dot => dot.classList.remove('active'));
      slides[n].classList.add('active');
      dots[n].classList.add('active');
      currentSlide = n;
  }

  function nextSlide() {
      showSlides(currentSlide + 1);
  }

  function prevSlide() {
      showSlides(currentSlide - 1);
  }

  function goToSlide(n) {
      showSlides(n);
  }