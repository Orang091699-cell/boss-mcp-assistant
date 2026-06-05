import { captureScrolledNodeScreenshots } from "../../core/capture/index.js";
import {
  clickPoint,
  getNodeBox,
  scrollNodeIntoView,
  sleep
} from "../../core/browser/index.js";
import {
  compactCvAcquisitionState,
  countParsedNetworkProfiles,
  createCvAcquisitionState,
  getCvNetworkWaitPlan,
  recordCvImageFallback,
  recordCvNetworkHit,
  recordCvNetworkMiss,
  summarizeImageEvidence,
  waitForCvNetworkEvents
} from "../../core/cv-acquisition/index.js";
import {
  compactInfiniteListState,
  createInfiniteListState,
  getNextInfiniteListCandidate,
  markInfiniteListCandidateProcessed
} from "../../core/infinite-list/index.js";
import { createRunLifecycleManager } from "../../core/run/index.js";
import {
  callScreeningLlm,
  compactScreening,
  isResumeTooSimple,
  normalizeText,
  scoreCandidate,
  screenCandidate
} from "../../core/screening/index.js";
import {
  CHAT_INTERN_PERIOD_KEYWORDS,
  CHAT_INTERN_START_KEYWORDS,
  CHAT_TARGET_URL
} from "./constants.js";
import {
  chatCandidateKeyFromProfile,
  findChatCandidateNodeIdById,
  readChatCardCandidate,
  waitForChatCandidateNodeIds
} from "./cards.js";
import {
  acceptAndReplyAttachmentResume,
  closeChatResumeModal,
  createChatProfileNetworkRecorder,
  extractChatProfileCandidate,
  openChatOnlineResume,
  readChatConversationMessages,
  readChatConversationReadyState,
  selectChatMessageFilter,
  selectChatPrimaryLabel,
  sendChatMessage,
  sendChatRejectionMessage,
  setChatEditorMessage,
  waitForChatOnlineResumeButton,
  waitForChatProfileNetworkEvents,
  waitForChatResumeContent
} from "./detail.js";
import { selectChatJob } from "./jobs.js";
import {
  getChatTopLevelState,
  isForbiddenChatResumeNavigationError,
  makeForbiddenChatResumeNavigationError,
  recoverChatShell
} from "./page-guard.js";
import { getChatRoots } from "./roots.js";

const DETAIL_SOURCES = new Set(["cascade", "network", "dom", "image"]);

function normalizeDetailSource(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return DETAIL_SOURCES.has(normalized) ? normalized : "cascade";
}

function compactLlmResult(llmResult) {
  if (!llmResult) return null;
  return {
    ok: Boolean(llmResult.ok),
    provider: llmResult.provider || null,
    passed: llmResult.passed,
    cot: llmResult.cot || llmResult.decision_cot || "",
    reasoning_content: llmResult.reasoning_content || "",
    raw_model_output: llmResult.raw_model_output || "",
    evidence_count: llmResult.evidence?.length || 0,
    usage: llmResult.usage || null,
    finish_reason: llmResult.finish_reason || null,
    image_input_count: llmResult.image_input_count || 0,
    error: llmResult.error || null
  };
}

function compactCandidate(candidate) {
  return {
    id: candidate?.id || null,
    identity: candidate?.identity || {},
    text_length: candidate?.text?.raw?.length || 0,
    tag_count: candidate?.tags?.length || 0
  };
}

function compactDetail(detailResult) {
  if (!detailResult) return null;
  return {
    popup_text_length: detailResult.detail?.popup_text?.length || 0,
    content_text_length: detailResult.detail?.content_text?.length || 0,
    resume_iframe_text_length: detailResult.detail?.resume_iframe_text?.length || 0,
    network_body_count: detailResult.network_bodies?.filter((item) => item.body).length || 0,
    parsed_network_profile_count: detailResult.parsed_network_profiles?.filter((item) => item.ok).length || 0,
    cv_acquisition: detailResult.cv_acquisition || null,
    image_evidence: summarizeImageEvidence(detailResult.image_evidence),
    llm_screening: compactLlmResult(detailResult.llm_result),
    close_result: detailResult.close_result
  };
}

function resultOpenedDetail(result) {
  return Boolean(result?.detail && !result.detail?.cv_acquisition?.skipped);
}

function llmToScreening(llmResult, candidate) {
  const scoredResult = {
    status: llmResult?.passed ? "pass" : "fail",
    passed: Boolean(llmResult?.passed),
    score: Number.isFinite(llmResult?.score) ? llmResult.score : (llmResult?.passed ? 100 : 0),
    dimension_scores: llmResult?.dimension_scores || null,
    evaluation: llmResult?.evaluation || null,
    reasons: llmResult?.error ? ["llm_invalid_response"] : [],
    candidate
  };
  return scoredResult;
}

function captureNodeIdFromResumeState(resumeState) {
  return resumeState?.content?.node_id
    || resumeState?.popup?.node_id
    || resumeState?.resumeIframe?.node_id
    || null;
}

function isRecoverableCdpNodeError(error) {
  return /(?:Could not find node|No node with given id|Cannot find node|Could not compute box model)/i
    .test(String(error?.message || error || ""));
}

function isRecoverableLlmScreeningError(error) {
  return /(?:LLM response missing boolean passed decision|LLM response was not valid JSON)/i
    .test(String(error?.message || error || ""));
}

function createFailedLlmResult(error) {
  return {
    ok: false,
    passed: false,
    reason: "",
    evidence: [],
    cot: "",
    decision_cot: "",
    reasoning_content: "",
    raw_model_output: "",
    error: error?.message || String(error || "unknown"),
    screened_at: new Date().toISOString()
  };
}

function isInternJob(jobTitle) {
  const title = normalizeText(jobTitle || "");
  return title.includes("实习生") || title.includes("实习") || /intern/i.test(title);
}

const CHINESE_DIGIT_MAP = { "零": 0, "一": 1, "二": 2, "三": 3, "四": 4, "五": 5, "六": 6, "七": 7, "八": 8, "九": 9, "十": 10, "半": 0.5 };

function parseChineseNumber(text) {
  const digit = CHINESE_DIGIT_MAP[text];
  if (digit !== undefined) return digit;
  const num = Number(text);
  if (Number.isFinite(num)) return num;
  return null;
}

function parseInternMonths(text) {
  if (!text) return null;
  const digitMatch = text.match(/(\d+)\s*个月/);
  if (digitMatch) return Number(digitMatch[1]);
  for (const [word, num] of Object.entries(CHINESE_DIGIT_MAP)) {
    const pattern = new RegExp(`${word}\\s*个月`);
    if (pattern.test(text)) return num;
  }
  const rangeMatch = text.match(/(\d+)\s*[-~到至]\s*(\d+)\s*个月/);
  if (rangeMatch) return Number(rangeMatch[2]);
  return null;
}

function findConversationInternInfo(conversationText) {
  if (!conversationText) return { found: false, mentionsPeriod: false, mentionsStart: false, months: null };
  const text = normalizeText(conversationText);
  const mentionsPeriod = CHAT_INTERN_PERIOD_KEYWORDS.some((kw) => text.includes(kw));
  const mentionsStart = CHAT_INTERN_START_KEYWORDS.some((kw) => text.includes(kw));
  let months = null;
  if (mentionsPeriod) {
    months = parseInternMonths(text);
  }
  return { found: mentionsPeriod || mentionsStart, mentionsPeriod, mentionsStart, months };
}

async function sendChatMessageToConversation(client, text, dryRun = false) {
  if (!text) return { sent: false, reason: "no_text" };
  if (dryRun) return { sent: false, reason: "dry_run" };
  await closeChatResumeModal(client, { attemptsLimit: 2 });
  const editorOk = await setChatEditorMessage(client, text);
  if (!editorOk.ok) return { sent: false, reason: "editor_message_mismatch" };
  const sendOk = await sendChatMessage(client, text);
  return { sent: sendOk.sent, reason: sendOk.sent ? "sent" : "send_failed" };
}

async function sendAttachmentResumeRequestAndAutoAccept(client, {
  requestText,
  replyText,
  dryRun = false
} = {}) {
  const result = { request_sent: false, accepted: false, reply_sent: false };
  const msgResult = await sendChatMessageToConversation(client, requestText, dryRun);
  result.request_sent = msgResult.sent;
  if (!msgResult.sent || dryRun) return result;
  try {
    const acceptResult = await acceptAndReplyAttachmentResume(client, { replyText, dryRun: false });
    result.accepted = acceptResult.accepted || false;
    result.reply_sent = acceptResult.reply_sent || false;
    result.accept_reason = acceptResult.reason || null;
  } catch {
    result.accepted = false;
    result.accept_reason = "accept_failed";
  }
  return result;
}

function createSkippedDetailResult(cardCandidate, reason, error = null) {
  return {
    candidate: cardCandidate,
    parsed_network_profiles: [],
    network_bodies: [],
    detail: {},
    cv_acquisition: {
      source: reason,
      skipped: true,
      error: error?.message || null
    },
    close_result: null
  };
}

async function resolveFreshChatCardNodeId(client, {
  fallbackNodeId,
  candidate,
  rootNodeId = null
} = {}) {
  const candidateId = candidate?.id || "";
  if (!candidateId) return fallbackNodeId;
  let currentRootNodeId = rootNodeId;
  if (!currentRootNodeId) {
    const rootState = await getChatRoots(client);
    currentRootNodeId = rootState.rootNodes.top;
  }
  const freshNodeId = await findChatCandidateNodeIdById(client, currentRootNodeId, candidateId);
  return freshNodeId || fallbackNodeId;
}

async function selectFreshChatCandidate(client, {
  cardNodeId,
  candidate,
  timeoutMs,
  settleMs = 1200
} = {}) {
  let lastError = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const rootState = await getChatRoots(client);
    const freshNodeId = await resolveFreshChatCardNodeId(client, {
      fallbackNodeId: cardNodeId,
      candidate,
      rootNodeId: rootState.rootNodes.top
    });
    try {
      await scrollNodeIntoView(client, freshNodeId);
      await sleep(250);
      const box = await getNodeBox(client, freshNodeId);
      await clickPoint(client, box.center.x, box.center.y);
      if (settleMs > 0) await sleep(settleMs);
      const ready = await waitForChatOnlineResumeButton(client, {
        timeoutMs,
        expectedCandidateId: candidate?.id || ""
      });
      return {
        card_box: box,
        ready,
        card_node_id: freshNodeId,
        refreshed_node: freshNodeId !== cardNodeId,
        attempt: attempt + 1
      };
    } catch (error) {
      lastError = error;
      if (!isRecoverableCdpNodeError(error)) throw error;
      await sleep(350);
    }
  }
  throw lastError || new Error("Chat candidate selection failed");
}

function selectedDetailNetworkEvents(detailSource, selectionEvents, resumeEvents) {
  if (detailSource !== "network" && detailSource !== "cascade") return [];
  return [
    ...(selectionEvents || []),
    ...(resumeEvents || [])
  ];
}

async function setupChatRunContext(client, {
  job,
  normalizedStartFrom,
  readyTimeoutMs,
  listSettleMs,
  runControl
} = {}) {
  const rootState = await getChatRoots(client);
  runControl.checkpoint({
    top_document_node_id: rootState.rootNodes.top
  });

  const primaryLabel = await selectChatPrimaryLabel(client, {
    label: "全部",
    timeoutMs: readyTimeoutMs,
    settleMs: listSettleMs
  });
  runControl.checkpoint({
    chat_context_step: "primary_label",
    primary_label: primaryLabel
  });

  const jobSelection = normalizeText(job)
    ? await selectChatJob(client, rootState.rootNodes.top, {
        jobLabel: job,
        timeoutMs: readyTimeoutMs,
        settleMs: listSettleMs
      })
    : {
        selected: false,
        reason: "job_not_requested"
      };
  if (normalizeText(job) && !jobSelection.selected) {
    throw new Error(`Chat job selection failed: ${jobSelection.reason || "unknown"}`);
  }
  runControl.checkpoint({
    chat_context_step: "job_selection",
    primary_label: primaryLabel,
    job_selection: jobSelection
  });

  const startFilter = await selectChatMessageFilter(client, {
    startFrom: normalizedStartFrom,
    timeoutMs: readyTimeoutMs,
    settleMs: listSettleMs
  });
  if (!startFilter.ok) {
    throw new Error(`Chat start filter selection failed: ${startFilter.error || "unknown"}`);
  }
  runControl.checkpoint({
    chat_context_step: "start_filter",
    primary_label: primaryLabel,
    job_selection: jobSelection,
    start_filter: startFilter
  });

  return {
    rootState,
    contextSetup: {
      primary_label: primaryLabel,
      job_selection: jobSelection,
      start_filter: startFilter,
      requested_start_from: normalizedStartFrom
    }
  };
}

export async function runChatWorkflow({
  client,
  targetUrl = CHAT_TARGET_URL,
  job = "",
  startFrom = "all",
  criteria = "",
  maxCandidates = 5,
  targetPassCount = null,
  processUntilListEnd = false,
  detailLimit = 0,
  detailSource = "cascade",
  closeResume = true,
  requestResumeForPassed = false,
  dryRunRequestCv = false,
  greetingText = "Hi同学，能麻烦发下简历吗？",
  rejectionText = "",
  delayMs = 0,
  cardTimeoutMs = 90000,
  readyTimeoutMs = 60000,
  onlineResumeButtonTimeoutMs = 30000,
  resumeDomTimeoutMs = 60000,
  maxImagePages = 8,
  imageWheelDeltaY = 650,
  cvAcquisitionMode = "unknown",
  callLlmOnImage = false,
  llmConfig = null,
  llmTimeoutMs = 120000,
  llmImageLimit = 8,
  llmImageDetail = "high",
  listMaxScrolls = 20,
  listStableSignatureLimit = 2,
  listWheelDeltaY = 850,
  listSettleMs = 1200,
  listFallbackPoint = null,
  minResumeTextLength = 30,
  internMode = false,
  internPeriodQuestionText = "你好呀，请问实习周期和最快到岗时间是什么时候呢？",
  internResumeRequestText = "同学你好呀，方便发送一份附件简历吗",
  attachmentResumeRequestText = "您好，方便发送一份附件简历吗？",
  resumeAcceptReplyText = "收到，稍后我会交给业务评估，如果通过的话会及时和您电话约面",
  autoAcceptAttachmentResume = false
} = {}, runControl) {
  if (!client) throw new Error("runChatWorkflow requires a guarded CDP client");
  const normalizedDetailSource = normalizeDetailSource(detailSource);
  const processedLimit = Math.max(1, Number(maxCandidates) || 1);
  const passTarget = Number.isFinite(Number(targetPassCount)) && Number(targetPassCount) > 0
    ? Number(targetPassCount)
    : null;
  const normalizedStartFrom = normalizeText(startFrom).toLowerCase() === "unread" ? "unread" : "all";
  const detailCountLimit = Math.max(0, Number(detailLimit) || 0);
  const networkRecorder = detailCountLimit > 0
    ? createChatProfileNetworkRecorder(client)
    : null;
  const cvAcquisitionState = createCvAcquisitionState({ mode: cvAcquisitionMode });
  const listState = createInfiniteListState({
    domain: "chat",
    listName: "chat-candidates"
  });
  const results = [];
  let cardNodeIds = [];
  let listEndReason = "";
  let requestedCount = 0;
  let requestSatisfiedCount = 0;
  let requestSkippedCount = 0;
  let contextSetup = {};

  runControl.setPhase("chat:cleanup");
  let initialTopLevelState = await getChatTopLevelState(client);
  if (!initialTopLevelState.is_chat_shell) {
    const recovery = await recoverChatShell(client, {
      targetUrl,
      timeoutMs: readyTimeoutMs
    });
    runControl.checkpoint({
      chat_shell_recovery: {
        reason: "initial_non_chat_shell",
        ...recovery
      }
    });
    if (!recovery.recovered) {
      throw new Error(`Chat shell recovery failed before run setup: ${recovery.after?.url || recovery.before?.url || "unknown"}`);
    }
    initialTopLevelState = recovery.after;
  }
  await closeChatResumeModal(client, { attemptsLimit: 2 });

  await runControl.waitIfPaused();
  runControl.throwIfCanceled();
  runControl.setPhase("chat:context");
  const setup = await setupChatRunContext(client, {
    job,
    normalizedStartFrom,
    readyTimeoutMs,
    listSettleMs,
    runControl
  });
  let rootState = setup.rootState;
  contextSetup = {
    ...setup.contextSetup,
    initial_top_level_state: initialTopLevelState
  };
  runControl.checkpoint({
    chat_context: contextSetup
  });

  async function recoverAndReapplyChatContext(reason, error = null) {
    runControl.setPhase("chat:recover_shell");
    const recovery = await recoverChatShell(client, {
      targetUrl,
      timeoutMs: readyTimeoutMs
    });
    runControl.checkpoint({
      chat_shell_recovery: {
        reason,
        error: error?.message || null,
        ...recovery
      }
    });
    if (!recovery.recovered && !recovery.after?.is_chat_shell) {
      throw new Error(`Chat shell recovery failed after ${reason}: ${recovery.after?.url || recovery.before?.url || "unknown"}`);
    }
    await closeChatResumeModal(client, { attemptsLimit: 2 });
    const recoveredSetup = await setupChatRunContext(client, {
      job,
      normalizedStartFrom,
      readyTimeoutMs,
      listSettleMs,
      runControl
    });
    rootState = recoveredSetup.rootState;
    contextSetup = {
      ...recoveredSetup.contextSetup,
      recovered_from: reason,
      recovery,
      previous_context: contextSetup
    };
    runControl.checkpoint({
      chat_context: contextSetup
    });
    return recovery;
  }

  await runControl.waitIfPaused();
  runControl.throwIfCanceled();
  runControl.setPhase("chat:cards");
  const cardRootState = await getChatRoots(client);
  const initialCards = await waitForChatCandidateNodeIds(client, cardRootState.rootNodes.top, {
    timeoutMs: cardTimeoutMs,
    intervalMs: 500
  });
  cardNodeIds = initialCards.nodeIds || [];
  if (!cardNodeIds.length) {
    runControl.checkpoint({
      empty_list_state: {
        method: "cdp_dom_selector_count",
        candidate_count: 0,
        requested_start_from: normalizedStartFrom
      }
    });
    listEndReason = "no_chat_candidates_found";
    runControl.updateProgress({
      card_count: 0,
      target_count: passTarget || (processUntilListEnd ? "all" : processedLimit),
      target_pass_count: passTarget,
      processed_limit: processedLimit,
      processed: 0,
      screened: 0,
      detail_opened: 0,
      llm_screened: 0,
      passed: 0,
      requested: 0,
      request_satisfied: 0,
      request_skipped: 0,
      unique_seen: compactInfiniteListState(listState).seen_count,
      scroll_count: compactInfiniteListState(listState).scroll_count,
      list_end_reason: listEndReason
    });
    runControl.setPhase("chat:done");
    return {
      domain: "chat",
      target_url: targetUrl,
      card_count: 0,
      context_setup: contextSetup,
      empty_list_state: {
        method: "cdp_dom_selector_count",
        candidate_count: 0,
        requested_start_from: normalizedStartFrom
      },
      candidate_list: compactInfiniteListState(listState),
      list_end_reason: listEndReason,
      target_pass_count: passTarget,
      process_until_list_end: Boolean(processUntilListEnd),
      processed_limit: processedLimit,
      detail_source: normalizedDetailSource,
      processed: 0,
      screened: 0,
      detail_opened: 0,
      llm_screened: 0,
      passed: 0,
      requested: requestedCount,
      request_satisfied: requestSatisfiedCount,
      request_skipped: requestSkippedCount,
      results
    };
  }

  runControl.updateProgress({
    card_count: cardNodeIds.length,
    target_count: passTarget || (processUntilListEnd ? "all" : processedLimit),
    target_pass_count: passTarget,
    processed_limit: processedLimit,
    processed: 0,
    screened: 0,
    detail_opened: 0,
    llm_screened: 0,
    passed: 0,
    requested: 0,
    request_satisfied: 0,
    request_skipped: 0,
    unique_seen: compactInfiniteListState(listState).seen_count,
    scroll_count: 0
  });

  while (
    results.length < processedLimit
    && (
      !passTarget
      || results.filter((item) => item.screening?.passed).length < passTarget
    )
  ) {
    await runControl.waitIfPaused();
    runControl.throwIfCanceled();
    runControl.setPhase("chat:candidate");
    const loopTopLevelState = await getChatTopLevelState(client);
    if (!loopTopLevelState.is_chat_shell) {
      await recoverAndReapplyChatContext("candidate_loop_non_chat_shell", {
        message: `Unexpected chat top-level URL: ${loopTopLevelState.url}`
      });
      continue;
    }

    const nextCandidateResult = await getNextInfiniteListCandidate({
      client,
      state: listState,
      maxScrolls: listMaxScrolls,
      stableSignatureLimit: listStableSignatureLimit,
      wheelDeltaY: listWheelDeltaY,
      settleMs: listSettleMs,
      fallbackPoint: listFallbackPoint,
      findNodeIds: async () => {
        const currentRootState = await getChatRoots(client);
        const currentCards = await waitForChatCandidateNodeIds(client, currentRootState.rootNodes.top, {
          timeoutMs: Math.min(cardTimeoutMs, 8000),
          intervalMs: 500
        });
        cardNodeIds = currentCards.nodeIds || [];
        return cardNodeIds;
      },
      keyForCandidate: chatCandidateKeyFromProfile,
      readCandidate: async (nodeId, { visibleIndex }) => readChatCardCandidate(client, nodeId, {
        targetUrl,
        source: "chat-run-card",
        metadata: {
          run_candidate_index: results.length,
          visible_index: visibleIndex
        }
      })
    });
    if (!nextCandidateResult.ok) {
      const endTopLevelState = await getChatTopLevelState(client);
      if (!endTopLevelState.is_chat_shell) {
        await recoverAndReapplyChatContext("candidate_list_end_non_chat_shell", {
          message: `Unexpected chat top-level URL at list end: ${endTopLevelState.url}`
        });
        continue;
      }
      if (nextCandidateResult.reason === "empty_visible_list") {
        runControl.checkpoint({
          terminal_empty_list_state: {
            method: "cdp_dom_selector_count",
            reason: nextCandidateResult.reason,
            requested_start_from: normalizedStartFrom
          }
        });
      }
      listEndReason = nextCandidateResult.reason || "list_exhausted";
      break;
    }

    const index = results.length;
    const cardNodeId = nextCandidateResult.item.node_id;
    let effectiveCardNodeId = cardNodeId;
    const candidateKey = nextCandidateResult.item.key;
    const cardCandidate = nextCandidateResult.item.candidate;

    let screeningCandidate = cardCandidate;
    let detailResult = null;
    let preActionState = null;
    let detailUnavailableReason = "";
    if (index < detailCountLimit) {
      let detailStep = "start";
      try {
        await runControl.waitIfPaused();
        runControl.throwIfCanceled();
        runControl.setPhase("chat:detail");

        detailStep = "select_candidate";
        networkRecorder.clear();
        const selected = await selectFreshChatCandidate(client, {
          cardNodeId,
          candidate: cardCandidate,
          timeoutMs: onlineResumeButtonTimeoutMs
        });
        if (selected.ready?.forbidden_top_level_navigation) {
          throw makeForbiddenChatResumeNavigationError(selected.ready.top_level_state);
        }
        effectiveCardNodeId = selected.card_node_id || cardNodeId;
        const selectionNetworkEvents = networkRecorder.events.slice();

        if (!selected.ready?.ok) {
          if (selected.ready?.reason === "active_candidate_mismatch") {
            detailUnavailableReason = "active_candidate_mismatch";
            detailResult = createSkippedDetailResult(cardCandidate, detailUnavailableReason);
            detailResult.cv_acquisition.selection_ready_state = selected.ready;
          } else {
            detailStep = "read_conversation_ready_state";
            preActionState = await readChatConversationReadyState(client);
            if (preActionState.attachment_resume_enabled) {
              detailUnavailableReason = "attachment_resume_already_available";
              detailResult = createSkippedDetailResult(cardCandidate, "attachment_resume_already_available");
            } else {
              detailUnavailableReason = "online_resume_button_unavailable";
              detailResult = createSkippedDetailResult(cardCandidate, detailUnavailableReason);
            }
          }
        }

        if (!detailResult) {
          detailStep = "open_online_resume";
          networkRecorder.clear();
          const openedResume = await openChatOnlineResume(client, {
            timeoutMs: readyTimeoutMs
          });
          const waitPlan = getCvNetworkWaitPlan(cvAcquisitionState);
          detailStep = "wait_network";
          const networkWait = ["network", "cascade"].includes(normalizedDetailSource)
            ? await waitForCvNetworkEvents(
                waitForChatProfileNetworkEvents,
                networkRecorder,
                {
                  waitPlan,
                  minCount: 1,
                  requireLoaded: true,
                  intervalMs: 200
                }
              )
            : null;
          let contentWait = {
            ok: false,
            skipped: false,
            reason: "not_started",
            elapsed_ms: 0,
            text_length: 0
          };
          let resumeState = openedResume.resume_state;
          let resumeHtml = null;
          let resumeNetworkEvents = networkRecorder.events.slice();
          let parsedNetworkProfileCount = 0;

          if (
            ["network", "cascade"].includes(normalizedDetailSource)
            && networkWait?.count > 0
          ) {
            detailStep = "extract_network_profile";
            detailResult = await extractChatProfileCandidate(client, {
              cardCandidate,
              cardNodeId: effectiveCardNodeId,
              resumeState,
              resumeHtml,
              networkEvents: selectedDetailNetworkEvents(
                normalizedDetailSource,
                selectionNetworkEvents,
                resumeNetworkEvents
              ),
              targetUrl,
              closeResume: false
            });
            parsedNetworkProfileCount = countParsedNetworkProfiles(detailResult);
            if (parsedNetworkProfileCount > 0) {
              contentWait = {
                ok: true,
                skipped: true,
                reason: "network_profile_parsed_before_dom_wait",
                elapsed_ms: 0,
                text_length: 0
              };
            } else {
              detailResult = null;
            }
          }

          if (!detailResult) {
            detailStep = "wait_resume_content";
            contentWait = await waitForChatResumeContent(client, {
              timeoutMs: resumeDomTimeoutMs,
              intervalMs: 300
            });
            resumeState = contentWait.resume_state || openedResume.resume_state;
            resumeHtml = contentWait.resume_html || null;
            resumeNetworkEvents = networkRecorder.events.slice();
            detailStep = "extract_resume_content";
            detailResult = await extractChatProfileCandidate(client, {
              cardCandidate,
              cardNodeId: effectiveCardNodeId,
              resumeState,
              resumeHtml,
              networkEvents: selectedDetailNetworkEvents(
                normalizedDetailSource,
                selectionNetworkEvents,
                resumeNetworkEvents
              ),
              targetUrl,
              closeResume: false
            });
            parsedNetworkProfileCount = countParsedNetworkProfiles(detailResult);
          }

          let source = normalizedDetailSource === "dom" ? "dom" : "network";
          let imageEvidence = null;
          let llmResult = null;
          const captureNodeId = captureNodeIdFromResumeState(resumeState);
          const shouldCaptureImage = normalizedDetailSource === "image"
            || (normalizedDetailSource === "cascade" && parsedNetworkProfileCount < 1);
          if (shouldCaptureImage) {
            if (captureNodeId) {
              detailStep = "capture_image_fallback";
              imageEvidence = await captureScrolledNodeScreenshots(client, captureNodeId, {
                padding: 8,
                maxScreenshots: maxImagePages,
                wheelDeltaY: imageWheelDeltaY,
                settleMs: 1200,
                metadata: {
                  domain: "chat",
                  capture_mode: "scroll_sequence",
                  acquisition_reason: normalizedDetailSource === "image"
                    ? "forced_image"
                    : "network_miss_image_fallback",
                  run_candidate_index: index,
                  candidate_key: candidateKey
                }
              });
              source = "image";
              recordCvImageFallback(cvAcquisitionState, {
                parsedNetworkProfileCount,
                waitResult: networkWait,
                imageEvidence
              });
                if (callLlmOnImage) {
                  if (!llmConfig) throw new Error("callLlmOnImage requires llmConfig");
                  detailStep = "llm_image_screening";
                  try {
                    llmResult = await callScreeningLlm({
                      candidate: detailResult.candidate,
                      criteria,
                      config: llmConfig,
                      timeoutMs: llmTimeoutMs,
                      imageEvidence,
                      maxImages: llmImageLimit,
                      imageDetail: llmImageDetail,
                      mode: llmConfig.dimensions ? "score" : "boolean",
                      dimensions: llmConfig.dimensions || null
                    });
                  } catch (error) {
                    if (!isRecoverableLlmScreeningError(error)) throw error;
                    llmResult = createFailedLlmResult(error);
                  }
                }
            } else {
              source = "missing_capture_node";
              recordCvNetworkMiss(cvAcquisitionState, {
                reason: "network_miss_no_capture_node",
                parsedNetworkProfileCount,
                waitResult: networkWait
              });
            }
          } else if (parsedNetworkProfileCount > 0) {
            recordCvNetworkHit(cvAcquisitionState, {
              parsedNetworkProfileCount,
              waitResult: networkWait
            });
          } else if (normalizedDetailSource !== "dom") {
            source = "network_miss";
            recordCvNetworkMiss(cvAcquisitionState, {
              reason: "network_miss_without_image_fallback",
              parsedNetworkProfileCount,
              waitResult: networkWait
            });
          }

          if (llmConfig && !llmResult) {
            detailStep = "llm_screening";
            try {
              llmResult = await callScreeningLlm({
                candidate: detailResult.candidate,
                criteria,
                config: llmConfig,
                timeoutMs: llmTimeoutMs,
                imageEvidence,
                maxImages: llmImageLimit,
                imageDetail: llmImageDetail,
                mode: llmConfig.dimensions ? "score" : "boolean",
                dimensions: llmConfig.dimensions || null
              });
            } catch (error) {
              if (!isRecoverableLlmScreeningError(error)) throw error;
              llmResult = createFailedLlmResult(error);
            }
          }

          let closeResult = null;
          if (closeResume) {
            detailStep = "close_resume_modal";
            closeResult = await closeChatResumeModal(client);
          }
          detailResult.close_result = closeResult;
          detailResult.image_evidence = imageEvidence;
          detailResult.llm_result = llmResult;
          detailResult.cv_acquisition = {
            source,
            mode_after: compactCvAcquisitionState(cvAcquisitionState).mode,
            wait_plan: waitPlan,
            network_wait: networkWait,
            selection_network_event_count: selectionNetworkEvents.length,
            resume_network_event_count: resumeNetworkEvents.length,
            content_wait: {
              ok: contentWait.ok,
              skipped: Boolean(contentWait.skipped),
              reason: contentWait.reason || null,
              elapsed_ms: contentWait.elapsed_ms,
              text_length: contentWait.text_length
            },
            parsed_network_profile_count: parsedNetworkProfileCount,
            image_evidence: summarizeImageEvidence(imageEvidence)
          };
        }
      } catch (error) {
        if (isForbiddenChatResumeNavigationError(error)) {
          detailUnavailableReason = "forbidden_top_level_resume_navigation";
          const recovery = await recoverAndReapplyChatContext(detailUnavailableReason, error);
          detailResult = createSkippedDetailResult(cardCandidate, detailUnavailableReason, error);
          detailResult.cv_acquisition.recovery = recovery;
        } else {
          if (!isRecoverableCdpNodeError(error)) throw error;
          detailUnavailableReason = `recoverable_cdp_node_stale:${detailStep}`;
          detailResult = createSkippedDetailResult(cardCandidate, detailUnavailableReason, error);
          await closeChatResumeModal(client, { attemptsLimit: 2 });
        }
      }
      screeningCandidate = detailResult.candidate;
    }

    let resumeTooSimpleResult = null;
    if (!detailUnavailableReason && screeningCandidate?.text?.raw) {
      resumeTooSimpleResult = isResumeTooSimple(screeningCandidate, { minMeaningfulTextLength: minResumeTextLength });
      if (resumeTooSimpleResult?.too_simple) {
        detailUnavailableReason = resumeTooSimpleResult.reason;
      }
    }

    await runControl.waitIfPaused();
    runControl.throwIfCanceled();
    runControl.setPhase("chat:screening");
    const screening = detailUnavailableReason
      ? {
          status: "skip",
          passed: false,
          score: 0,
          resume_too_simple: resumeTooSimpleResult?.too_simple || false,
          reasons: [detailUnavailableReason],
          candidate: screeningCandidate
        }
      : detailResult?.llm_result
        ? llmToScreening(detailResult.llm_result, screeningCandidate)
        : llmConfig?.dimensions
          ? await scoreCandidate({
              candidate: screeningCandidate,
              criteria,
              config: llmConfig
            })
          : screenCandidate(screeningCandidate, { criteria });
    let postAction = null;
    let internAction = null;
    let rejectionResult = null;
    if (screening.passed) {
      if (internMode && isInternJob(job)) {
        try {
          const convMsg = await readChatConversationMessages(client);
          const internInfo = convMsg?.ok ? findConversationInternInfo(convMsg.text) : { found: false, mentionsPeriod: false, mentionsStart: false, months: null };

          if (!internInfo.mentionsPeriod || !internInfo.mentionsStart) {
            const msgResult = await sendChatMessageToConversation(client, internPeriodQuestionText, dryRunRequestCv);
            internAction = {
              type: "intern_period_question",
              asked: msgResult.sent,
              period_found: internInfo.mentionsPeriod,
              start_found: internInfo.mentionsStart,
              months_parsed: internInfo.months
            };
          } else if (internInfo.months !== null && internInfo.months >= 3) {
            const msgResult = await sendChatMessageToConversation(client, internResumeRequestText, dryRunRequestCv);
            internAction = {
              type: "intern_resume_request",
              asked: msgResult.sent,
              months: internInfo.months,
              period_found: true,
              start_found: true
            };
          }
        } catch {
          internAction = { type: "intern_error", error: "intern_check_failed" };
        }
      }

      if (!internAction && requestResumeForPassed) {
        postAction = await sendAttachmentResumeRequestAndAutoAccept(client, {
          requestText: attachmentResumeRequestText,
          replyText: resumeAcceptReplyText,
          dryRun: dryRunRequestCv
        });
        if (postAction?.request_sent) requestedCount += 1;
      }
    } else if (screening.status !== "skip" && rejectionText) {
      rejectionResult = await sendChatRejectionMessage(client, {
        rejectionText,
        dryRun: dryRunRequestCv
      });
    }
    const compactResult = {
      index,
      candidate_key: candidateKey,
      card_node_id: effectiveCardNodeId,
      candidate: compactCandidate(screeningCandidate),
      detail: compactDetail(detailResult),
      screening: compactScreening(screening, { defaultDomain: "chat" }),
      post_action: postAction,
      intern_action: internAction,
      rejection_result: rejectionResult,
      pre_action_state: preActionState
    };
    results.push(compactResult);
    markInfiniteListCandidateProcessed(listState, candidateKey, {
      metadata: {
        result_index: index,
        candidate_id: screeningCandidate.id || null
      }
    });

    runControl.updateProgress({
      card_count: cardNodeIds.length,
      target_count: passTarget || (processUntilListEnd ? "all" : processedLimit),
      target_pass_count: passTarget,
      processed_limit: processedLimit,
      processed: results.length,
      screened: results.length,
      detail_opened: results.filter(resultOpenedDetail).length,
      llm_screened: results.filter((item) => item.detail?.llm_screening).length,
      passed: results.filter((item) => item.screening.passed).length,
      requested: requestedCount,
      request_satisfied: requestSatisfiedCount,
      request_skipped: requestSkippedCount,
      unique_seen: compactInfiniteListState(listState).seen_count,
      scroll_count: compactInfiniteListState(listState).scroll_count,
      list_end_reason: listEndReason || null,
      last_candidate_id: screeningCandidate.id || null,
      last_candidate_key: candidateKey,
      last_score: screening.score
    });
    runControl.checkpoint({
      last_candidate: {
        id: screeningCandidate.id || null,
        key: candidateKey,
        identity: screeningCandidate.identity || {},
        screening: {
          status: screening.status,
          passed: screening.passed,
          score: screening.score
        }
      }
    });

    if (delayMs > 0) {
      await runControl.sleep(delayMs);
    }
  }

  runControl.setPhase("chat:done");
  return {
    domain: "chat",
    target_url: targetUrl,
    card_count: cardNodeIds.length,
    context_setup: contextSetup,
    candidate_list: compactInfiniteListState(listState),
    list_end_reason: listEndReason || null,
    target_pass_count: passTarget,
    process_until_list_end: Boolean(processUntilListEnd),
    processed_limit: processedLimit,
    detail_source: normalizedDetailSource,
    processed: results.length,
    screened: results.length,
    detail_opened: results.filter(resultOpenedDetail).length,
    llm_screened: results.filter((item) => item.detail?.llm_screening).length,
    passed: results.filter((item) => item.screening.passed).length,
    requested: requestedCount,
    request_satisfied: requestSatisfiedCount,
    request_skipped: requestSkippedCount,
    results
  };
}

export function createChatRunService({
  lifecycle,
  idPrefix = "chat",
  workflow = runChatWorkflow
} = {}) {
  const manager = lifecycle || createRunLifecycleManager({ idPrefix });

  function startChatRun({
    client,
    targetUrl = CHAT_TARGET_URL,
    job = "",
    startFrom = "all",
    criteria = "",
    maxCandidates = 5,
    targetPassCount = null,
    processUntilListEnd = false,
    detailLimit = 0,
    detailSource = "cascade",
    closeResume = true,
    requestResumeForPassed = false,
    dryRunRequestCv = false,
    greetingText = "Hi同学，能麻烦发下简历吗？",
    rejectionText = "",
    delayMs = 0,
    cardTimeoutMs = 90000,
    readyTimeoutMs = 60000,
    onlineResumeButtonTimeoutMs = 30000,
    resumeDomTimeoutMs = 60000,
    maxImagePages = 8,
    imageWheelDeltaY = 650,
    cvAcquisitionMode = "unknown",
    callLlmOnImage = false,
    llmConfig = null,
    llmTimeoutMs = 120000,
    llmImageLimit = 8,
    llmImageDetail = "high",
    listMaxScrolls = 20,
    listStableSignatureLimit = 2,
    listWheelDeltaY = 850,
    listSettleMs = 1200,
    listFallbackPoint = null,
    minResumeTextLength = 30,
    internMode = false,
    internPeriodQuestionText = "你好呀，请问实习周期和最快到岗时间是什么时候呢？",
    internResumeRequestText = "同学你好呀，方便发送一份附件简历吗",
    attachmentResumeRequestText = "您好，方便发送一份附件简历吗？",
    resumeAcceptReplyText = "收到，稍后我会交给业务评估，如果通过的话会及时和您电话约面",
    autoAcceptAttachmentResume = false,
    name = "chat-domain-run"
  } = {}) {
    if (!client) throw new Error("startChatRun requires a guarded CDP client");
    const normalizedDetailSource = normalizeDetailSource(detailSource);
    return manager.startRun({
      name,
      context: {
        domain: "chat",
        target_url: targetUrl,
        criteria_present: Boolean(criteria),
        job,
        start_from: startFrom,
        max_candidates: maxCandidates,
        target_pass_count: targetPassCount,
        process_until_list_end: Boolean(processUntilListEnd),
        detail_limit: detailLimit,
        detail_source: normalizedDetailSource,
        close_resume: closeResume,
        cv_acquisition_mode: cvAcquisitionMode,
        has_rejection_text: Boolean(rejectionText),
        call_llm_on_image: Boolean(callLlmOnImage),
        max_image_pages: maxImagePages,
        image_wheel_delta_y: imageWheelDeltaY,
        list_max_scrolls: listMaxScrolls,
        list_stable_signature_limit: listStableSignatureLimit,
        list_wheel_delta_y: listWheelDeltaY,
        list_settle_ms: listSettleMs,
        list_fallback_point: listFallbackPoint,
        online_resume_button_timeout_ms: onlineResumeButtonTimeoutMs
      },
      progress: {
        card_count: 0,
        target_count: targetPassCount || (processUntilListEnd ? "all" : Math.max(1, Number(maxCandidates) || 1)),
        target_pass_count: targetPassCount,
        processed_limit: Math.max(1, Number(maxCandidates) || 1),
        processed: 0,
        screened: 0,
        detail_opened: 0,
        llm_screened: 0,
        passed: 0,
        requested: 0,
        request_satisfied: 0,
        request_skipped: 0
      },
      checkpoint: {},
      task: (runControl) => workflow({
        client,
        targetUrl,
        job,
        startFrom,
        criteria,
        maxCandidates,
        targetPassCount,
        processUntilListEnd,
        detailLimit,
        detailSource: normalizedDetailSource,
        closeResume,
        requestResumeForPassed,
        dryRunRequestCv,
        greetingText,
        rejectionText,
        delayMs,
        cardTimeoutMs,
        readyTimeoutMs,
        onlineResumeButtonTimeoutMs,
        resumeDomTimeoutMs,
        maxImagePages,
        imageWheelDeltaY,
        cvAcquisitionMode,
        callLlmOnImage,
        llmConfig,
        llmTimeoutMs,
        llmImageLimit,
        llmImageDetail,
        listMaxScrolls,
        listStableSignatureLimit,
        listWheelDeltaY,
        listSettleMs,
        listFallbackPoint,
        minResumeTextLength,
        internMode,
        internPeriodQuestionText,
        internResumeRequestText,
        attachmentResumeRequestText,
        resumeAcceptReplyText,
        autoAcceptAttachmentResume
      }, runControl)
    });
  }

  return {
    startChatRun,
    getChatRun: manager.getRun,
    pauseChatRun: manager.pauseRun,
    resumeChatRun: manager.resumeRun,
    cancelChatRun: manager.cancelRun,
    waitForChatRun: manager.waitForRun,
    listChatRuns: manager.listRuns,
    manager
  };
}
