<script setup lang="ts">
import {
  useSessionStore,
  type CreateSessionCommentParams,
  type SessionCommentFilter
} from '@/stores/session.store'
import { computed, onMounted, ref, watch } from 'vue'
import { Icon } from '@iconify/vue'
import { useAppStore } from '@/stores/app.store'
import AppButton from '@/components/AppButton.vue'
import { TransitionRoot } from '@headlessui/vue'
import CommentItem from './CommentItem.vue'
import AppTextInput from '@/components/AppTextInput.vue'
import { getRandomString } from '@/lib/func'
import moment from 'moment'
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera'
import { useToast } from 'vue-toastification'
import AppActionSheet from '@/components/AppActionSheet.vue'
import { Device } from '@capacitor/device'

// ================================
// STORES & COMPOSABLES
// ================================
const appStore = useAppStore()
const sessionStore = useSessionStore()
const toast = useToast()

// ================================
// TYPES & PROPS
// ================================
interface ImageData {
  base64: string
  file_name: string
  size: number
  width: number
  height: number
}
interface Props {
  show?: boolean
}
interface Emits {
  (e: 'close'): void
}

const props = withDefaults(defineProps<Props>(), {
  show: false
})
const emit = defineEmits<Emits>()

type CommentType = 'general' | 'assessment'

// ================================
// CONSTANTS
// ================================
const MAX_IMAGES = 4
const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB

const filterOptions: { value: SessionCommentFilter; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'general', label: 'General' },
  { value: 'assessment', label: 'ABC data' },
  { value: 'target', label: 'From targets' },
  { value: 'mine', label: 'Added by you' }
]

const typeInputOptions: { value: CommentType; label: string }[] = [
  { value: 'general', label: 'General' },
  { value: 'assessment', label: 'ABC data' }
]

// ================================
// REACTIVE STATE
// ================================
const showPermissionModal = ref<boolean>(false)
const permissionType = ref<'camera' | 'gallery'>('camera')
const permissionMessage = ref<string>('')
const isIOS = ref<boolean>(false)

// Comments
const commentsLoading = ref<boolean>(false)
const filter = ref<SessionCommentFilter>('')

// Add New Comment Modal
const showNew = ref<boolean>(false)
const typeInput = ref<CommentType>('general')
const bodyInput = ref<string>('')
const antecedentInput = ref<string>('')
const behaviorInput = ref<string>('')
const consequenceInput = ref<string>('')
const createLoading = ref<boolean>(false)

// Image Management
const selectedImages = ref<ImageData[]>([])
const currentImageIndex = ref<number>(0)
const libraryLoading = ref<boolean>(false)
const imagePreviewOpened = ref<boolean>(false)

// Camera
const capturedImage = ref<string>('')
const showPreview = ref<boolean>(false)
const cameraLoading = ref<boolean>(false)

// ================================
// COMPUTED
// ================================
const bottomContainerStyle = computed(() => {
  if (isIOS.value) {
    return {
      paddingTop: '16px',
      paddingBottom: 'max(55px, env(safe-area-inset-bottom))',
      minHeight: '88px'
    }
  }
  return {}
})

const isDisabledCreate = computed<boolean>(() => {
  // Jika ada gambar, tidak perlu validasi input text
  if (selectedImages.value.length > 0) {
    return false
  }

  // Jika tidak ada gambar, validasi input text
  if (typeInput.value === 'general') {
    return !bodyInput.value.trim()
  }

  if (typeInput.value === 'assessment') {
    return (
      !antecedentInput.value.trim() && !behaviorInput.value.trim() && !consequenceInput.value.trim()
    )
  }

  return false
})

// ================================
// UTILITY FUNCTIONS
// ================================
const generateFilename = (prefix: string, extension: string): string => {
  const timestamp = new Date().getTime()
  return `${prefix}_${timestamp}.${extension}`
}

const getFileExtensionFromMimeType = (mimeType: string): string => {
  const mimeMap: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'image/bmp': 'bmp'
  }
  return mimeMap[mimeType] || 'jpg'
}

const getMimeTypeFromDataUrl = (dataUrl: string): string => {
  const match = dataUrl.match(/^data:([^;]+);/)
  return match ? match[1] : 'image/jpeg'
}

// ================================
// IMAGE UTILITIES
// ================================
const getImageSizeFromDataUrl = (
  dataUrl: string
): Promise<{ width: number; height: number; size: number }> => {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      // More accurate size calculation
      const base64String = dataUrl.split(',')[1] || ''
      const padding = (base64String.match(/=/g) || []).length
      const sizeInBytes = (base64String.length * 3) / 4 - padding

      resolve({
        width: img.width,
        height: img.height,
        size: sizeInBytes
      })
    }
    img.src = dataUrl
  })
}
const validateImageSize = (imageSize: number): boolean => {
  return imageSize <= MAX_FILE_SIZE
}

const validateAndShowImageError = (imageSize: number, filename?: string): boolean => {
  if (!validateImageSize(imageSize)) {
    const sizeMB = (imageSize / (1024 * 1024)).toFixed(1)
    const maxSizeMB = (MAX_FILE_SIZE / (1024 * 1024)).toFixed(0)
    toast.error(
      `${filename ? filename + ' is' : 'Image is'} too large (${sizeMB}MB). Maximum size is ${maxSizeMB}MB.`
    )
    return false
  }
  return true
}

const createImageData = async (dataUrl: string, originalPath?: string): Promise<ImageData> => {
  const imageInfo = await getImageSizeFromDataUrl(dataUrl)
  const mimeType = getMimeTypeFromDataUrl(dataUrl)
  const extension = getFileExtensionFromMimeType(mimeType)

  let filename: string

  if (originalPath) {
    const pathParts = originalPath.split('/')
    const originalFilename = pathParts[pathParts.length - 1]

    if (
      originalFilename &&
      (originalFilename.includes('.jpg') ||
        originalFilename.includes('.jpeg') ||
        originalFilename.includes('.png') ||
        originalFilename.includes('.webp'))
    ) {
      filename = originalFilename
    } else {
      filename = generateFilename('gallery_image', extension)
    }
  } else {
    filename = generateFilename('camera_capture', extension)
  }

  return {
    base64: dataUrl,
    file_name: filename,
    size: imageInfo.size,
    width: imageInfo.width,
    height: imageInfo.height
  }
}
// ================================
// IMAGE MANAGEMENT FUNCTIONS
// ================================
const clearAllImages = () => {
  selectedImages.value = []
  currentImageIndex.value = 0
}

const checkCameraPermission = async (): Promise<boolean> => {
  try {
    const permission = await Camera.checkPermissions()

    if (permission.camera === 'granted') {
      return true
    }

    if (permission.camera === 'denied') {
      // Permission sudah di-deny sebelumnya
      showPermissionDeniedModal('camera')
      return false
    }

    // Request permission jika belum pernah diminta
    const requestResult = await Camera.requestPermissions({ permissions: ['camera'] })

    if (requestResult.camera === 'granted') {
      return true
    } else {
      showPermissionDeniedModal('camera')
      return false
    }
  } catch (error) {
    console.error('Error checking camera permission:', error)
    showPermissionDeniedModal('camera')
    return false
  }
}
const checkGalleryPermission = async (): Promise<boolean> => {
  try {
    const permission = await Camera.checkPermissions()

    if (permission.photos === 'granted') {
      return true
    }

    if (permission.photos === 'denied') {
      // Permission sudah di-deny sebelumnya
      showPermissionDeniedModal('gallery')
      return false
    }

    // Request permission jika belum pernah diminta
    const requestResult = await Camera.requestPermissions({ permissions: ['photos'] })

    if (requestResult.photos === 'granted') {
      return true
    } else {
      showPermissionDeniedModal('gallery')
      return false
    }
  } catch (error) {
    console.error('Error checking gallery permission:', error)
    showPermissionDeniedModal('gallery')
    return false
  }
}

const showPermissionDeniedModal = (type: 'camera' | 'gallery') => {
  permissionType.value = type

  if (type === 'camera') {
    permissionMessage.value = 'To take photos, please allow camera access in your browser settings.'
  } else {
    permissionMessage.value =
      'To select photos, please allow gallery access in your browser settings.'
  }

  showPermissionModal.value = true
}

const closePermissionModal = () => {
  showPermissionModal.value = false
}

const removeSelectedImage = (index: number) => {
  selectedImages.value.splice(index, 1)

  if (currentImageIndex.value >= selectedImages.value.length) {
    currentImageIndex.value = Math.max(0, selectedImages.value.length - 1)
  }

  if (selectedImages.value.length === 0) {
    currentImageIndex.value = 0
  }
}

// ================================
// CAMERA FUNCTIONS
// ================================
const openCamera = async () => {
  // Check permission dulu
  const hasPermission = await checkCameraPermission()
  if (!hasPermission) {
    return
  }

  try {
    cameraLoading.value = true
    const image = await Camera.getPhoto({
      quality: 100,
      allowEditing: false,
      resultType: CameraResultType.DataUrl,
      source: CameraSource.Camera,
      saveToGallery: true,
      correctOrientation: true,
      presentationStyle: 'fullscreen'
    })

    if (image.dataUrl) {
      const imageInfo = await getImageSizeFromDataUrl(image.dataUrl)

      if (imageInfo.size > MAX_FILE_SIZE) {
        const sizeMB = (imageInfo.size / (1024 * 1024)).toFixed(1)
        const maxSizeMB = (MAX_FILE_SIZE / (1024 * 1024)).toFixed(0)
        toast.warning(`Photo is too large (${sizeMB}MB). Maximum size is ${maxSizeMB}MB.`)
        return
      }
      capturedImage.value = image.dataUrl
      showPreview.value = true
    }
  } catch (error: any) {
    // Check apakah error karena user cancel
    const errorMessage = error?.message || error?.toString() || ''
    const isCancelled =
      errorMessage.includes('cancelled') ||
      errorMessage.includes('canceled') ||
      errorMessage.includes('User cancelled') ||
      errorMessage.includes('User canceled') ||
      errorMessage.includes('User did not select')

    if (!isCancelled) {
      console.error('Error taking photo:', error)
      toast.error('Error taking photo')
    }
  } finally {
    cameraLoading.value = false
  }
}

const usePhoto = async () => {
  if (capturedImage.value && selectedImages.value.length < MAX_IMAGES) {
    try {
      const imageData = await createImageData(capturedImage.value)

      // Tambah validasi ukuran untuk foto dari camera
      if (imageData.size > MAX_FILE_SIZE) {
        const sizeMB = (imageData.size / (1024 * 1024)).toFixed(1)
        const maxSizeMB = (MAX_FILE_SIZE / (1024 * 1024)).toFixed(0)
        toast.warning(`Image is too large (${sizeMB}MB). Maximum size is ${maxSizeMB}MB.`)
        capturedImage.value = ''
        showPreview.value = false
        return
      }

      selectedImages.value.push(imageData)
    } catch (error) {
      console.error('Error processing captured photo:', error)
      toast.error('Error processing photo')
    }
  }
  capturedImage.value = ''
  showPreview.value = false
  showNew.value = true
}

const discardPhoto = () => {
  capturedImage.value = ''
  showPreview.value = false
}

// ================================
// LIBRARY FUNCTIONS
// ================================
const openLibraryWithCamera = async () => {
  // Check permission dulu
  const hasPermission = await checkGalleryPermission()
  if (!hasPermission) {
    return
  }

  try {
    libraryLoading.value = true

    const remainingSlots = MAX_IMAGES - selectedImages.value.length
    if (remainingSlots <= 0) {
      toast.warning(`You have already selected the maximum of ${MAX_IMAGES} photos`)
      return
    }

    const images = await Camera.pickImages({
      quality: 90,
      width: 1024,
      limit: remainingSlots,
      correctOrientation: true
    })

    if (images && images.photos && images.photos.length > 0) {
      const processedImages: ImageData[] = []
      for (const photo of images.photos) {
        if (selectedImages.value.length + processedImages.length >= MAX_IMAGES) {
          break
        }

        let base64Data = photo.webPath
        if (!base64Data?.startsWith('data:')) {
          try {
            base64Data = await convertToBase64(photo.webPath)
          } catch {
            toast.warning('Failed to convert photo to base64, skipped')
            continue
          }
        }

        if (!base64Data) continue

        const imageInfo = await getImageSizeFromDataUrl(base64Data)

        if (!validateAndShowImageError(imageInfo.size, photo.path?.split('/').pop())) {
          continue
        }

        const imageData = await createImageData(base64Data, photo.path)
        processedImages.push(imageData)
      }

      if (processedImages.length > 0) {
        selectedImages.value.push(...processedImages)
        currentImageIndex.value = selectedImages.value.length - processedImages.length
      }
    }
  } catch (error) {
    if (
      error &&
      typeof error === 'object' &&
      'message' in error &&
      typeof (error as { message?: unknown }).message === 'string'
    ) {
      const msg = (error as { message: string }).message
      if (msg.includes('cancelled') || msg.includes('User cancelled')) {
        return // User cancelled, don't show error
      }
    }
    console.error('Error picking images:', error)
    toast.error('Error selecting photos')
  } finally {
    libraryLoading.value = false
  }
}

const openImagePreview = (index: number) => {
  currentImageIndex.value = index
  imagePreviewOpened.value = true
}
async function convertToBase64(url: string): Promise<string> {
  const response = await fetch(url)
  const blob = await response.blob()
  if (blob.size > MAX_FILE_SIZE) {
    toast.error('Image is too large. Maximum size is 5MB.')
    return ''
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      if (reader.result && typeof reader.result === 'string') {
        resolve(reader.result)
      } else {
        reject('Failed to convert to base64')
      }
    }
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

const openLibrary = async () => {
  await openLibraryWithCamera()
}

// ================================
// COMMENT FUNCTIONS
// ================================
const fetchComments = async () => {
  commentsLoading.value = true
  const id = sessionStore.session?.id
  const { success } = await sessionStore.getSessionComments({ id, filter: filter.value })
  commentsLoading.value = false
  if (!success) return
  document.getElementById('session-comments')?.scroll({ top: 0, behavior: 'smooth' })
}

const resetCommentForm = () => {
  bodyInput.value = ''
  antecedentInput.value = ''
  behaviorInput.value = ''
  consequenceInput.value = ''
}

const onCreate = async () => {
  const params: CreateSessionCommentParams = {
    client_id: sessionStore.session?.client_id,
    session_id: sessionStore.session?.id,
    type: typeInput.value,
    session_comment: {
      user_id: appStore.account?.id,
      body: bodyInput.value
    },
    assessment: {
      session_id: sessionStore.session?.id,
      antecedent: antecedentInput.value,
      behavior: behaviorInput.value,
      consequence: consequenceInput.value,
      type: 'Assessment::InSession'
    },
    data_result: {
      id: getRandomString(),
      body: bodyInput.value,
      is_edited: false,
      user_id: appStore.account?.id,
      user_name: appStore.account?.name,
      antecedent: antecedentInput.value,
      behavior: behaviorInput.value,
      consequence: consequenceInput.value,
      type: typeInput.value === 'assessment' ? 'Assessment::InSession' : undefined,
      client_id: sessionStore.session?.client_id,
      session_id: sessionStore.session?.id,
      created_at: moment().format(),
      updated_at: moment().format()
    },
    images: selectedImages.value.map((img) => ({
      base64: img.base64,
      file_name: img.file_name,
      size: img.size,
      width: img.width,
      height: img.height
    }))
  }

  createLoading.value = true
  const { success } = await sessionStore.createSessionComment(params)
  createLoading.value = false

  if (!success) return

  showNew.value = false
  resetCommentForm()
}

// ================================
// WATCHERS
// ================================
watch(
  () => props.show,
  (val) => {
    if (val) fetchComments()
  }
)

watch(filter, () => {
  fetchComments()
})

watch(showNew, (val) => {
  if (val) {
    if (filter.value === 'assessment') {
      typeInput.value = 'assessment'
    } else {
      typeInput.value = 'general'
    }
    resetCommentForm()
  } else {
    // Reset filter if type doesn't match
    if (filter.value === 'assessment' && typeInput.value === 'general') {
      filter.value = ''
    }
    if (filter.value === 'general' && typeInput.value === 'assessment') {
      filter.value = ''
    }
    clearAllImages()
  }
})

onMounted(async () => {
  const deviceInfo = await Device.getInfo()
  isIOS.value = deviceInfo.platform === 'ios'
})
</script>

<template>
  <!-- Main Comments Modal -->
  <TransitionRoot
    :show="show"
    enter="transition ease-in-out duration-300 transform"
    enter-from="-translate-x-full"
    enter-to="translate-x-0"
    leave="transition ease-in-out duration-300 transform"
    leave-from="translate-x-0"
    leave-to="-translate-x-full"
    id="session-comments"
    class="no-scrollbar fixed left-0 top-0 z-[200] h-screen w-screen overflow-y-auto bg-prim-3 p-safe"
  >
    <!-- Header -->
    <div class="fixed top-0 z-[999] w-screen bg-white pt-safe"></div>
    <div class="fixed bottom-0 z-[999] w-screen bg-white pb-safe"></div>

    <div class="sticky top-0 z-[10] shrink-0">
      <div class="flex h-[52px] items-center gap-3 bg-white px-4">
        <div
          class="flex items-center justify-center w-8 h-8 rounded-full cursor-pointer shrink-0 bg-slate-2"
          @click="emit('close')"
        >
          <Icon icon="ph:caret-left" class="text-slate-7" />
        </div>
        <div class="text-[22px] font-bold">Comments</div>
      </div>

      <!-- Filter Options -->
      <div class="pl-4 bg-prim-3">
        <div
          class="flex items-center h-12 gap-2 px-8 overflow-x-auto snap-x snap-mandatory scroll-smooth"
        >
          <div
            v-for="opt in filterOptions"
            :key="opt.value"
            class="flex items-center h-8 px-3 text-xs font-medium transition-all border rounded-full cursor-pointer shrink-0 snap-start"
            :class="[
              filter === opt.value
                ? 'border-light-purple-2 bg-prim-1 text-dark-purple-1'
                : 'border-slate-4 bg-white'
            ]"
            @click="filter = filter === opt.value ? '' : opt.value"
          >
            {{ opt.label }}
          </div>
        </div>
      </div>
    </div>

    <!-- Comments List -->
    <div v-if="commentsLoading" class="px-4 pt-4 pb-24 space-y-4">
      <div
        v-for="n in 3"
        :key="n"
        class="w-full h-32 rounded shrink-0 animate-pulse bg-prim-1"
      ></div>
    </div>

    <div
      v-else-if="!sessionStore.session_comments.length"
      class="flex items-center justify-center w-full h-64 px-4 py-4 text-sm text-center text-light-purple-5"
    >
      Be the first to add a comment to this session.
    </div>

    <div v-else class="px-4 pt-4 pb-24 space-y-4">
      <CommentItem
        v-for="comment in sessionStore.session_comments"
        :key="comment.id"
        :comment="comment"
        :actionable="
          comment.user_id === appStore.account?.id &&
          !comment.measurement_id &&
          sessionStore.session?.status === 'ongoing'
        "
      />
    </div>

    <!-- Floating Action Buttons -->
    <div
      v-if="sessionStore.session?.status === 'ongoing'"
      class="fixed bottom-0 flex items-center justify-center w-screen h-20 gap-4 transition-all p-safe"
      :class="{ 'opacity-0': filter === 'target' }"
      :style="bottomContainerStyle"
    >
      <div
        class="flex h-[60px] w-[60px] shrink-0 cursor-pointer items-center justify-center rounded-full border-2 border-white bg-light-purple-5"
        :style="{ boxShadow: '2px 2px 0px 0px #D6C7E066' }"
        @click="openCamera"
        :class="{ 'opacity-50': cameraLoading }"
      >
        <Icon v-if="!cameraLoading" icon="ph:camera" class="text-3xl text-white" />
        <div
          v-else
          class="w-6 h-6 border-2 border-white rounded-full animate-spin border-t-transparent"
        ></div>
      </div>

      <div
        class="flex h-[60px] w-[60px] shrink-0 cursor-pointer items-center justify-center rounded-full border-2 border-white bg-light-purple-5"
        :style="{ boxShadow: '2px 2px 0px 0px #D6C7E066' }"
        @click="showNew = true"
      >
        <Icon icon="ph:chat-centered-text" class="text-3xl text-white" />
      </div>
    </div>
  </TransitionRoot>

  <!-- Camera Preview Modal -->
  <TransitionRoot
    :show="showPreview"
    enter="transition-all duration-300 ease-out"
    enter-from="opacity-0 scale-95"
    enter-to="opacity-100 scale-100"
    leave="transition-all duration-200 ease-in"
    leave-from="opacity-100 scale-100"
    leave-to="opacity-0 scale-95"
    class="fixed left-0 top-0 z-[1022] h-screen w-screen bg-[#1d2939]"
  >
    <div class="relative w-full h-full">
      <div class="flex items-center justify-center h-full">
        <img
          :src="capturedImage"
          alt="Captured photo"
          class="object-contain max-w-full max-h-full"
        />
      </div>

      <div
        class="absolute bottom-2 left-0 right-0 z-10 flex items-center justify-between bg-[#1d2939] p-6 pb-safe"
      >
        <AppButton @click="discardPhoto" color="gray" class="w-16 h-16 rounded-full">
          <Icon icon="line-md:close" class="text-4xl" />
        </AppButton>

        <AppButton
          :loading="cameraLoading"
          :disabled="cameraLoading"
          @click="usePhoto"
          color="gray"
          class="w-16 h-16 rounded-full"
        >
          <Icon icon="ph:check" class="text-4xl" />
        </AppButton>
      </div>
    </div>
  </TransitionRoot>

  <!-- Add Comment Modal -->
  <TransitionRoot
    :show="showNew"
    enter="transition-all duration-300 ease-out"
    enter-from="opacity-0 scale-75"
    enter-to="opacity-100 scale-100"
    leave="transition-all duration-200 ease-in"
    leave-from="opacity-100 scale-100"
    leave-to="opacity-0 scale-75"
    class="fixed left-0 top-0 z-[1021] h-screen w-screen bg-white p-safe"
  >
    <div class="fixed top-0 z-[999999] w-screen bg-white pt-safe"></div>
    <div class="fixed bottom-0 z-[999999] w-screen bg-white pb-safe"></div>

    <div class="flex-colh-[52px] sticky top-0 z-[10] flex shrink-0 flex-col gap-3 bg-white px-4">
      <div class="flex h-[52px] items-center gap-3">
        <div
          class="flex items-center justify-center w-8 h-8 rounded-full shrink-0 bg-slate-2"
          @click="showNew = false"
        >
          <Icon icon="ph:caret-left" class="text-slate-7" />
        </div>
        <div class="text-2xl text-[22px] font-bold">Add new comments</div>
      </div>
      <div class="flex items-center gap-2 mb-2">
        <div
          v-for="opt in typeInputOptions"
          :key="opt.value"
          class="flex items-center h-8 px-3 text-xs font-medium transition-all border rounded-full cursor-pointer shrink-0 snap-start"
          :class="[
            typeInput === opt.value
              ? 'border-light-purple-2 bg-prim-1 text-dark-purple-1'
              : 'border-slate-4 bg-white'
          ]"
          @click="typeInput = opt.value"
        >
          {{ opt.label }}
        </div>
      </div>
    </div>
    <div class="h-[calc(100vh-52px-120px)] scroll-pb-32 overflow-y-scroll">
      <AppTextInput
        v-if="typeInput === 'general'"
        name="new-comment-body"
        type="textarea"
        placeholder="Type your comment here..."
        v-model="bodyInput"
        borderless
        class="h-full px-4"
      />
      <div v-if="typeInput === 'assessment'" class="h-full space-y-2">
        <div class="px-4 text-sm font-medium text-slate-7">Antecedent</div>
        <AppTextInput
          name="new-comment-antecedent"
          type="textarea"
          placeholder="Type your comment here..."
          v-model="antecedentInput"
          borderless
          class="h-[20vh] px-4"
        />
        <div class="h-0.5 w-full shrink-0 bg-slate-3"></div>
        <div class="px-4 text-sm font-medium text-slate-7">Behavior</div>
        <AppTextInput
          name="new-comment-behavior"
          type="textarea"
          placeholder="Type your comment here..."
          v-model="behaviorInput"
          borderless
          class="h-[20vh] px-4"
        />
        <div class="h-0.5 w-full shrink-0 bg-slate-3"></div>
        <div class="px-4 text-sm font-medium text-slate-7">Consequence</div>
        <AppTextInput
          name="new-comment-consequence"
          type="textarea"
          placeholder="Type your comment here..."
          v-model="consequenceInput"
          borderless
          class="h-[20vh] px-4"
        />
      </div>
    </div>
    <div class="fixed bottom-0 w-screen bg-white px-safe pb-safe">
      <div v-if="selectedImages.length > 0" class="px-4">
        <div class="flex items-center gap-3">
          <div v-for="(image, index) in selectedImages" :key="index" class="relative">
            <div class="relative w-16 h-16 rounded-lg shadow-sm">
              <img
                @click="openImagePreview(index)"
                :src="image.base64"
                :alt="image.file_name"
                class="object-cover w-full h-full rounded-lg"
              />
              <div
                @click="removeSelectedImage(index)"
                class="absolute z-50 flex items-center justify-center w-5 h-5 text-white bg-red-500 rounded-full -right-2 -top-2"
              >
                <Icon icon="ph:x" class="text-xs" />
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="flex items-center justify-between h-16 px-4 grow">
        <div
          v-if="
            !selectedImages.length ||
            (selectedImages.length > 0 && selectedImages.length < MAX_IMAGES)
          "
          class="flex items-center"
        >
          <AppButton kind="plain" size="sm" class="hover:bg-slate-4" @click="openCamera">
            <Icon icon="ph:camera" class="text-2xl text-slate-7" />
          </AppButton>
          <AppButton
            kind="plain"
            size="sm"
            class="hover:bg-slate-4"
            @click="openLibrary"
            :disabled="libraryLoading"
            :loading="libraryLoading"
          >
            <Icon icon="icons8:picture" class="text-2xl text-slate-7" />
          </AppButton>
        </div>
        <div v-else class="text-sm text-slate-7">You can only add up to 4 pictures.</div>
        <AppButton :loading="createLoading" :disabled="isDisabledCreate" @click="onCreate">
          <div>Add</div>
          <Icon icon="ph:plus-bold" />
        </AppButton>
      </div>
    </div>
  </TransitionRoot>

  <!-- Image Preview Modal -->
  <TransitionRoot
    :show="imagePreviewOpened"
    enter="transition-all duration-300 ease-out"
    enter-from="opacity-0 scale-95"
    enter-to="opacity-100 scale-100"
    leave="transition-all duration-200 ease-in"
    leave-from="opacity-100 scale-100"
    leave-to="opacity-0 scale-95"
    class="fixed left-0 top-0 z-[1025] h-screen w-screen bg-[#1d2939]"
  >
    <div class="relative w-full h-full">
      <!-- Close button -->
      <div class="absolute z-20 left-4 top-4 pt-safe">
        <div
          class="flex items-center justify-center w-10 h-10 rounded-full cursor-pointer bg-pure-white backdrop-blur-sm"
          @click="imagePreviewOpened = false"
        >
          <Icon icon="ph:x" class="text-xl text-slate-7" />
        </div>
      </div>

      <!-- Image -->
      <div class="flex items-center justify-center h-full">
        <img
          :src="selectedImages[currentImageIndex]?.base64"
          :alt="selectedImages[currentImageIndex]?.file_name"
          class="max-h-[50vh] max-w-[100vw] object-contain"
        />
      </div>

      <!-- Navigation arrows -->
      <div
        v-if="selectedImages.length > 1"
        class="absolute inset-y-0 left-0 right-0 flex items-center justify-between"
      >
        <!-- Left arrow -->
        <div
          class="flex items-center justify-center w-12 h-12 ml-4 rounded-full bg-pure-white backdrop-blur-sm"
          :class="{
            'cursor-pointer': currentImageIndex > 0,
            'opacity-50': currentImageIndex === 0
          }"
          @click="currentImageIndex > 0 && currentImageIndex--"
        >
          <Icon icon="ph:caret-left" class="text-2xl text-slate-7" />
        </div>

        <!-- Right arrow -->
        <div
          class="flex items-center justify-center w-12 h-12 mr-4 rounded-full bg-pure-white backdrop-blur-sm"
          :class="{
            'cursor-pointer': currentImageIndex < selectedImages.length - 1,
            'opacity-50': currentImageIndex === selectedImages.length - 1
          }"
          @click="currentImageIndex < selectedImages.length - 1 && currentImageIndex++"
        >
          <Icon icon="ph:caret-right" class="text-2xl text-slate-7" />
        </div>
      </div>
    </div>
  </TransitionRoot>

  <TransitionRoot
    :show="createLoading"
    enter="transition-opacity ease-linear duration-300"
    enter-from="opacity-0"
    enter-to="opacity-100"
    leave="transition-opacity ease-linear duration-300"
    leave-from="opacity-100"
    leave-to="opacity-0"
    class="fixed inset-0 z-[1050] flex items-center justify-center bg-white/75"
  >
    <div class="flex items-center justify-center">
      <div
        class="w-16 h-16 border-4 border-t-4 rounded-full animate-spin border-light-purple-5 border-t-transparent"
      ></div>
    </div>
  </TransitionRoot>

  <AppActionSheet :show="showPermissionModal" @close="closePermissionModal">
    <div class="py-3">
      <!-- Icon -->
      <div class="flex justify-center mb-4">
        <div class="flex items-center justify-center w-16 h-16 rounded-full bg-red-50">
          <Icon
            :icon="permissionType === 'camera' ? 'ph:camera-slash' : 'uil:image-slash'"
            class="text-3xl text-red-500"
          />
        </div>
      </div>

      <!-- Title -->
      <div class="mb-2 text-lg font-semibold text-center text-slate-800">
        {{ permissionType === 'camera' ? 'Camera Access Required' : 'Gallery Access Required' }}
      </div>

      <!-- Message -->
      <div class="mb-6 text-sm text-center text-slate-600">
        {{ permissionMessage }}
      </div>

      <!-- Button -->
      <div class="flex justify-center">
        <AppButton @click="closePermissionModal" class="px-8 py-2"> Okay </AppButton>
      </div>
    </div>
  </AppActionSheet>
</template>
