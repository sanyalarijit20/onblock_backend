const successResponse = (res, data = null, message = 'Success', statusCode = 200) => {
  const response = {
    success: true,
    message,
    data,
    timestamp: new Date().toISOString(),
  };

  return res.status(statusCode).json(response);
};


const errorResponse = (res, message = 'An error occurred', statusCode = 400, errorCode = 'ERROR', details = null) => {
  const response = {
    success: false,
    message,
    errorCode,
    timestamp: new Date().toISOString(),
  };

  
  if (details) {
    response.details = details;
  }

  return res.status(statusCode).json(response);
};


const paginatedResponse = (res, data, page, limit, total, message = 'Success') => {
  const totalPages = Math.ceil(total / limit);
  const hasNextPage = page < totalPages;
  const hasPrevPage = page > 1;

  const response = {
    success: true,
    message,
    data,
    pagination: {
      currentPage: page,
      totalPages,
      itemsPerPage: limit,
      totalItems: total,
      hasNextPage,
      hasPrevPage,
    },
    timestamp: new Date().toISOString(),
  };

  return res.status(200).json(response);
};


const createdResponse = (res, data, message = 'Resource created successfully') => {
  return successResponse(res, data, message, 201);
};


const noContentResponse = (res) => {
  return res.status(204).send();
};


const validationErrorResponse = (res, errors) => {
  return errorResponse(res, errors, 400, 'VALIDATION_ERROR');
};


const unauthorizedResponse = (res, message = 'Unauthorized access') => {
  return errorResponse(res, message, 401, 'UNAUTHORIZED');
};


const forbiddenResponse = (res, message = 'Access forbidden') => {
  return errorResponse(res, message, 403, 'FORBIDDEN');
};


const notFoundResponse = (res, message = 'Resource not found') => {
  return errorResponse(res, message, 404, 'NOT_FOUND');
};


const conflictResponse = (res, message = 'Resource already exists') => {
  return errorResponse(res, message, 409, 'CONFLICT');
};


const rateLimitResponse = (res, message = 'Too many requests, please try again later') => {
  return errorResponse(res, message, 429, 'RATE_LIMIT_EXCEEDED');
};


const internalErrorResponse = (res, message = 'Internal server error', details = null) => {
  return errorResponse(res, message, 500, 'INTERNAL_ERROR', details);
};

const serviceUnavailableResponse = (res, message = 'Service temporarily unavailable') => {
  return errorResponse(res, message, 503, 'SERVICE_UNAVAILABLE');
};

module.exports = {
  successResponse,
  errorResponse,
  paginatedResponse,
  createdResponse,
  noContentResponse,
  validationErrorResponse,
  unauthorizedResponse,
  forbiddenResponse,
  notFoundResponse,
  conflictResponse,
  rateLimitResponse,
  internalErrorResponse,
  serviceUnavailableResponse,
};