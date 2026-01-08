export const sanitizeErrorMessage = (error: any): string => {
  if (!error) return 'حدث خطأ غير متوقع';

  const errorMessage = error.message || error.toString();

  const sensitivePatterns = [
    /table\s+"?(\w+)"?/gi,
    /column\s+"?(\w+)"?/gi,
    /constraint\s+"?(\w+)"?/gi,
    /relation\s+"?(\w+)"?/gi,
    /database\s+"?(\w+)"?/gi,
    /schema\s+"?(\w+)"?/gi,
    /function\s+"?(\w+)"?/gi,
    /violates\s+\w+\s+constraint/gi,
    /duplicate key value/gi,
    /foreign key constraint/gi,
    /null value in column/gi,
    /ERROR:\s+\d+:/gi,
    /SQLSTATE\[\w+\]/gi,
  ];

  const errorMap: Record<string, string> = {
    'duplicate key': 'هذا السجل موجود بالفعل',
    'foreign key': 'لا يمكن إجراء هذه العملية بسبب ارتباطات موجودة',
    'not found': 'السجل غير موجود',
    'permission denied': 'ليس لديك صلاحية لإجراء هذه العملية',
    'null value': 'يرجى ملء جميع الحقول المطلوبة',
    'invalid input': 'البيانات المدخلة غير صحيحة',
    'unique constraint': 'هذا السجل موجود بالفعل',
    'network': 'خطأ في الاتصال بالخادم',
    'timeout': 'انتهت مهلة الاتصال',
    'authentication': 'خطأ في المصادقة',
    'unauthorized': 'غير مصرح',
    'not authenticated': 'يجب تسجيل الدخول أولاً',
  };

  let sanitizedMessage = errorMessage;

  sensitivePatterns.forEach(pattern => {
    sanitizedMessage = sanitizedMessage.replace(pattern, '***');
  });

  for (const [key, value] of Object.entries(errorMap)) {
    if (sanitizedMessage.toLowerCase().includes(key)) {
      return value;
    }
  }

  if (sanitizedMessage.includes('***') || sanitizedMessage.length > 100) {
    return 'حدث خطأ أثناء تنفيذ العملية';
  }

  return 'حدث خطأ غير متوقع';
};

export const handleDatabaseError = (error: any, customMessage?: string): string => {
  console.error('Database error:', error);

  if (customMessage) {
    return customMessage;
  }

  return sanitizeErrorMessage(error);
};