import { test, expect } from '@playwright/test'

test.describe('Original Document Viewer & Chat PDF Export', () => {
  test.beforeEach(async ({ page }) => {
    // Populate Supabase local storage session before page load to bypass redirect to /auth
    await page.addInitScript(() => {
      window.localStorage.setItem(
        'sb-knrpgzmeiinhyhmabaxo-auth-token',
        JSON.stringify({
          access_token: 'mocked-jwt-token',
          token_type: 'bearer',
          expires_in: 3600,
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          refresh_token: 'mocked-refresh-token',
          user: {
            id: 'mock-user-id',
            aud: 'authenticated',
            role: 'authenticated',
            email: 'test@example.com',
            phone: '',
            confirmed_at: new Date().toISOString(),
            last_sign_in_at: new Date().toISOString(),
            app_metadata: { provider: 'email', providers: ['email'] },
            user_metadata: {},
            identities: [],
            is_anonymous: false,
          },
        })
      )
    })

    // Intercept Supabase Auth session request
    await page.route('**/auth/v1/session**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          access_token: 'mocked-jwt-token',
          token_type: 'bearer',
          expires_in: 3600,
          refresh_token: 'mocked-refresh-token',
          user: {
            id: 'mock-user-id',
            aud: 'authenticated',
            role: 'authenticated',
            email: 'test@example.com',
            is_anonymous: false,
          },
        }),
      })
    })

    // Intercept Supabase Auth user request
    await page.route('**/auth/v1/user**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'mock-user-id',
          aud: 'authenticated',
          role: 'authenticated',
          email: 'test@example.com',
          is_anonymous: false,
        }),
      })
    })

    // Mock DB queries for Profile
    await page.route('**/rest/v1/profiles*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'mock-user-id',
          full_name: 'Jane Doe',
          avatar_url: null,
          role: 'user',
        }),
      })
    })

    // Mock DB queries for Chat Conversations
    await page.route('**/rest/v1/chat_conversations*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'mock-conv-id',
            analysis_id: 'mock-analysis-id',
            title: 'Blood Test Results',
            role_persona: 'default_clinical',
            created_at: new Date().toISOString(),
            pinned: false,
            archived: false,
          },
        ]),
      })
    })

    // Mock DB queries for Chat Messages - return actual database column names
    await page.route('**/rest/v1/chat_messages*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'mock-msg-1',
            conversation_id: 'mock-conv-id',
            role: 'user',
            content: 'What do these results mean?',
            model_used: 'gpt-4',
            status: 'sent',
            created_at: new Date().toISOString(),
          },
          {
            id: 'mock-msg-2',
            conversation_id: 'mock-conv-id',
            role: 'assistant',
            content: 'Your blood test results show normal glucose levels.',
            model_used: 'gpt-4',
            status: 'sent',
            created_at: new Date().toISOString(),
          },
        ]),
      })
    })

    // Mock DB queries for Documents table - return single object since query ends with .single()
    await page.route('**/rest/v1/documents*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'mock-doc-id',
          name: 'blood_test.png',
          document_type: 'image/png',
          file_path: 'uploads/blood_test.png',
          mime_type: 'image/png',
          status: 'completed',
          error_message: null,
          raw_ocr_text: 'Glucose: 90 mg/dL',
        }),
      })
    })

    // Mock DB queries for Analyses table
    await page.route('**/rest/v1/analyses*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'mock-analysis-id',
            document_id: 'mock-doc-id',
            summary: 'Your glucose is normal.',
            primary_result: 'Normal glucose levels',
            interpretation: 'All parameters are within standard ranges.',
            raw_response: '{}',
            language: 'en',
            created_at: new Date().toISOString(),
            structured_output: {
              sections: [{ title: 'Overview', content: 'Your glucose is normal.' }],
              abnormalValues: [],
            },
            doctor_questions: [],
          },
        ]),
      })
    })

    // Mock DB queries for Medicines table (empty array)
    await page.route('**/rest/v1/medicines*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      })
    })

    // Mock DB queries for Analysis Sources table (empty array)
    await page.route('**/rest/v1/analysis_sources*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      })
    })

    // Mock DB queries for Confidence Scores table - return single object since query ends with .maybeSingle()
    await page.route('**/rest/v1/confidence_scores*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          overall_confidence: 0.95,
        }),
      })
    })

    // Mock Storage Signed URL request
    await page.route('**/storage/v1/object/sign/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          signedUrl: 'https://placeholder.supabase.co/storage/v1/object/sign/Med-Decode-Ai/mock-image.png',
        }),
      })
    })

    // Mock the actual image source preview request
    await page.route('**/mock-image.png', async (route) => {
      // 1x1 transparent PNG
      const pngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
      await route.fulfill({
        status: 200,
        contentType: 'image/png',
        body: Buffer.from(pngBase64, 'base64'),
      })
    })
  })

  test('original document image preview loads lazily and asynchronously', async ({ page }) => {
    // Navigate to results page with query parameters
    await page.goto('/results?docId=mock-doc-id')

    // Expect page to load and display analysis summary card
    await expect(page.getByText('Your glucose is normal.').first()).toBeVisible({ timeout: 15_000 })

    // Locate and click "📄 Original" button to toggle the viewer
    const toggleButton = page.getByRole('button', { name: '📄 Original' }).first()
    await expect(toggleButton).toBeVisible()
    await toggleButton.click()

    // Locate the preview image element inside OriginalDocViewer
    const previewImage = page.locator('img[alt="Original document"]')
    await expect(previewImage).toBeVisible()

    // Assert that the image tag has lazy loading and async decoding set
    const loadingAttr = await previewImage.getAttribute('loading')
    const decodingAttr = await previewImage.getAttribute('decoding')

    expect(loadingAttr).toBe('lazy')
    expect(decodingAttr).toBe('async')
  })

  test('chat PDF export triggers successfully and dynamically loads jspdf', async ({ page }) => {
    await page.goto('/results?docId=mock-doc-id')
    await expect(page.getByText('Your glucose is normal.').first()).toBeVisible({ timeout: 15_000 })

    // Open export menu
    const exportBtn = page.getByRole('button', { name: '📥 Export' }).first()
    await expect(exportBtn).toBeVisible()
    await exportBtn.click()

    // Setup listener for download action
    const downloadPromise = page.waitForEvent('download')

    // Click "Export as PDF"
    const pdfBtn = page.getByRole('button', { name: '📄 PDF' }).first()
    await expect(pdfBtn).toBeVisible()
    await pdfBtn.click()

    // Download should trigger successfully
    const download = await downloadPromise
    expect(download.suggestedFilename()).toContain('chat.pdf')
  })
})
